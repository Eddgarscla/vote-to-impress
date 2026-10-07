import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { GATE_SESSION_MARKER_COOKIE } from "./gate-session-marker";
import {
  GATE_IDENTITY_HEADER,
  gateIdentityEnabled,
  gateIdentityFromHeaders,
  sessionBoundToGateIdentity,
} from "./gate-identity.server";

export const GATE_PROVIDER_ID = "grok-gate";
const LOG = "[gate-identity]";

/**
 * App accounts are created on purpose (email/password or broker OAuth).
 * The preview proxy also sends `x-grok-identity`. Materializing that header
 * into a session on `/get-session` dropped first-time visitors straight into
 * the populated feed, and the follow-up read (cookie present, hook re-entered
 * `getSession`) could leave the request hanging — the preview then stuck on
 * the loading shell after it was closed and opened again.
 *
 * This hook only evicts a gate-minted session so Welcome stays the signed-out
 * screen and Sign out is not instantly undone. Real sessions are left alone.
 */
export function gateIdentitySessions() {
  return {
    id: "grok-gate-identity",
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === "/get-session",
          handler: createAuthMiddleware(async (ctx) => {
            if (!gateIdentityEnabled()) return;
            const guard = ctx.context as { __vtiGateGuard?: boolean };
            if (guard.__vtiGateGuard) return;
            guard.__vtiGateGuard = true;

            const inbound = ctx.request?.headers ?? ctx.headers;
            if (!inbound) return;
            if (inbound.get("authorization")) return;

            if (!inbound.get(GATE_IDENTITY_HEADER)) {
              await clearGateMarkerIfPresent(ctx, inbound);
              return;
            }

            const sessionCookieName = ctx.context.authCookies.sessionToken.name;
            const cookieHeader = inbound.get("cookie") ?? "";
            if (!cookieHeader.includes(`${sessionCookieName}=`)) {
              await clearGateMarkerIfPresent(ctx, inbound);
              return;
            }

            let token: string | null = null;
            try {
              const signed = await ctx.getSignedCookie(sessionCookieName, ctx.context.secret);
              token = typeof signed === "string" ? signed : null;
            } catch (err) {
              console.error(`${LOG} getSignedCookie failed`, err);
              return;
            }
            if (!token) return;

            const existing = await withTimeout(
              ctx.context.internalAdapter.findSession(token).catch((err) => {
                console.error(`${LOG} findSession failed`, err);
                return null;
              }),
            );
            if (existing === "timeout" || !existing?.session || !existing.user) return;

            const accounts = await withTimeout(
              ctx.context.internalAdapter.findAccounts(existing.user.id).catch((err) => {
                console.error(`${LOG} findAccounts failed`, err);
                return null;
              }),
            );
            if (accounts === "timeout" || !Array.isArray(accounts)) return;

            const identity = await withTimeout(gateIdentityFromHeaders(inbound).catch(() => null));
            const bound =
              identity && identity !== "timeout"
                ? sessionBoundToGateIdentity(accounts, identity.sub, GATE_PROVIDER_ID)
                : false;
            const onlyGate =
              accounts.length > 0 && accounts.every((account) => account.providerId === GATE_PROVIDER_ID);
            if (!bound && !onlyGate) {
              await clearGateMarkerIfPresent(ctx, inbound);
              return;
            }

            await ctx.context.internalAdapter.deleteSession(existing.session.token).catch((err) => {
              console.error(`${LOG} deleteSession (gate session) failed`, err);
            });
            await expireAuthCookie(ctx, sessionCookieName);
            await expireSessionDataCookie(ctx, ctx.context.authCookies.sessionData);
            await writeGateMarkerCookie(ctx, true);

            const headers = new Headers(inbound);
            removeRequestCookie(headers, sessionCookieName);
            removeRequestCookie(headers, ctx.context.authCookies.sessionData.name);
            return { context: { headers } };
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T | "timeout"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve("timeout");
      },
    );
  });
}

async function expireAuthCookie(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
  name: string,
): Promise<void> {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(name, "", {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 0,
    });
  } catch (err) {
    console.error(`${LOG} TanStack setCookie (expire ${name}) failed`, err);
  }
  try {
    ctx.context.responseHeaders?.append(
      "set-cookie",
      `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    );
  } catch (err) {
    console.error(`${LOG} responseHeaders.append (expire ${name}) failed`, err);
  }
}

async function expireSessionDataCookie(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
  cookie: { name: string; attributes: { path?: string; secure?: boolean } },
): Promise<void> {
  const path = cookie.attributes.path ?? "/";
  const secure = cookie.attributes.secure ?? true;
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(cookie.name, "", {
      path,
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 0,
    });
  } catch (err) {
    console.error(`${LOG} TanStack setCookie (expire session_data) failed`, err);
  }
  try {
    ctx.context.responseHeaders?.append(
      "set-cookie",
      `${cookie.name}=; Path=${path}; HttpOnly; ` +
        `${secure ? "Secure; " : ""}SameSite=Lax; Max-Age=0`,
    );
  } catch (err) {
    console.error(`${LOG} responseHeaders.append (expire session_data) failed`, err);
  }
}

async function writeGateMarkerCookie(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
  clear: boolean,
): Promise<void> {
  const sessionMaxAge = ctx.context.sessionConfig.expiresIn;
  const maxAge = clear ? 0 : typeof sessionMaxAge === "number" ? sessionMaxAge : undefined;
  const value = clear ? "" : "1";
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(GATE_SESSION_MARKER_COOKIE, value, {
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      maxAge,
    });
  } catch (err) {
    console.error(`${LOG} TanStack setCookie (gate marker) failed`, err);
  }
  try {
    ctx.context.responseHeaders?.append(
      "set-cookie",
      `${GATE_SESSION_MARKER_COOKIE}=${value}; Path=/; Secure; SameSite=Lax` +
        (maxAge === undefined ? "" : `; Max-Age=${maxAge}`),
    );
  } catch (err) {
    console.error(`${LOG} responseHeaders.append (gate marker) failed`, err);
  }
}

async function clearGateMarkerIfPresent(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
  inbound: Headers,
): Promise<void> {
  const cookieHeader = inbound.get("cookie") ?? "";
  if (!cookieHeader.includes(`${GATE_SESSION_MARKER_COOKIE}=`)) return;
  await writeGateMarkerCookie(ctx, true);
}

function removeRequestCookie(headers: Headers, name: string): void {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return;
  const kept = cookieHeader
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair && !pair.startsWith(`${name}=`));
  if (kept.length > 0) headers.set("cookie", kept.join("; "));
  else headers.delete("cookie");
}
