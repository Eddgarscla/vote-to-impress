import { Link, Navigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Compass, House, Plus, Trophy, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BootProblem, BootScreen } from "@/components/boot";
import { FounderMenuButton } from "@/components/founder-menu";
import { Mark } from "@/components/mark";
import { cn } from "@/lib/cn";
import { useSessionBoot } from "@/lib/auth/use-session-boot";
import { ensureProfile, getFloor } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";
import { useI18n } from "@/lib/i18n";

const NAV = [
  { to: "/home", label: "Home", icon: House },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/challenges", label: "Challenges", icon: Trophy },
  { to: "/create", label: "Create", icon: Plus },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

function activePath(pathname: string, to: string) {
  if (to === "/challenges") return pathname.startsWith("/challenges");
  if (to === "/profile") return pathname === "/profile";
  return pathname === to;
}

export function AppShell({ children }: { children: ReactNode }) {
  const boot = useSessionBoot();
  const [profileNote, setProfileNote] = useState<string | null>(null);
  const [profileTick, setProfileTick] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const user = boot.user;
  const floor = useQuery(user ? "floor" : "signed-out", () => (user ? getFloor() : Promise.resolve(null)));
  const [liveTheme, setLiveTheme] = useState<string | null>(null);
  const [liveAccent, setLiveAccent] = useState<string | null>(null);
  useEffect(() => {
    const onTheme = (event: Event) => {
      const detail = (event as CustomEvent<{ themeKey?: string; accent?: string; weekly?: string; monthly?: string }>).detail ?? {};
      if (detail.themeKey) setLiveTheme(detail.themeKey);
      if ("accent" in detail) setLiveAccent(detail.accent ?? "");
    };
    window.addEventListener("vti-theme", onTheme);
    return () => window.removeEventListener("vti-theme", onTheme);
  }, []);
  const themeKey = liveTheme ?? floor.data?.themeKey ?? "haunted";
  const accent = liveAccent ?? floor.data?.accentColor ?? "";
  const palette =
    themeKey === "frost" ? "season-frost" :
    themeKey === "valentine" ? "season-valentine" :
    themeKey === "gloss" ? "season-gloss" :
    "season-haunted";
  const seasonClass = themeKey === "gloss" ? "" : `theme-${themeKey}`;
  const { t } = useI18n();
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const onToast = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (!message) return;
      setToast(message);
      window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2200);
    };
    window.addEventListener("vti-toast", onToast);
    return () => window.removeEventListener("vti-toast", onToast);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    const pending = window.sessionStorage.getItem("vti.pendingAvatar") ?? undefined;
    const timer = window.setTimeout(() => {
      if (!cancel) setProfileNote(t("stillSyncing"));
    }, 8000);
    ensureProfile({ data: { avatarDataUrl: pending || undefined } })
      .then((res) => {
        if (cancel) return;
        window.sessionStorage.removeItem("vti.pendingAvatar");
        if (res && res.ok === false) setProfileNote(res.error);
        else setProfileNote(null);
      })
      .catch(() => {
        if (!cancel) setProfileNote(t("couldNotSync"));
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [user?.id, profileTick, t]);

  if (boot.isPending && !boot.stalled && !boot.error) {
    return <BootScreen label={t("openingFloor")} />;
  }
  if (boot.stalled || (boot.error && !user)) {
    return (
      <BootProblem
        message={boot.error ?? "The session check did not finish. Nothing was lost."}
        onRetry={boot.retry}
      />
    );
  }
  if (!user) return <Navigate to="/" />;

  return (
    <div className={cn("min-h-dvh bg-stone", seasonClass, palette)} style={accent ? { ["--color-accent" as string]: accent } : undefined}>
      <div className={cn("stage relative", seasonClass, palette)}>
        {profileNote ? (
          <div className="flex items-center justify-between gap-3 border-b border-line bg-chip px-4 py-3 text-sm">
            <p className="text-ink">{profileNote}</p>
            <button type="button" className="shrink-0 font-medium text-accent underline underline-offset-4" onClick={() => setProfileTick((n) => n + 1)}>
              {t("tryAgain")}
            </button>
          </div>
        ) : null}
        {floor.data?.weeklyTheme || floor.data?.monthlyTheme ? (
          <p className="season-strip border-b border-line px-4 py-2 pr-14 text-center text-xs tracking-wide text-muted">
            {floor.data.weeklyTheme ? `${t("week")} · ${floor.data.weeklyTheme}` : null}
            {floor.data.weeklyTheme && floor.data.monthlyTheme ? "  ·  " : null}
            {floor.data.monthlyTheme ? `${t("month")} · ${floor.data.monthlyTheme}` : null}
          </p>
        ) : null}
        {floor.data?.role === "founder" ? (
          <div className="pointer-events-none sticky top-0 z-40 h-0">
            <div className="pointer-events-auto absolute top-1.5 right-2">
              <FounderMenuButton />
            </div>
          </div>
        ) : null}
        <div key={pathname} className="page-rise">{children}</div>
        {toast ? (
          <p className="toast-pop pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-line bg-paper px-4 py-2 text-sm shadow-lg">{toast}</p>
        ) : null}
        <nav className="nav-dock nav-safe fixed bottom-0 z-30 flex w-full max-w-[640px] items-end justify-around px-1 pt-1 lg:max-w-[1080px]" aria-label="Primary">
          {NAV.map((item) => {
            const on = activePath(pathname, item.to);
            const Icon = item.icon;
            if (item.to === "/create") {
              return (
                <Link key={item.to} to={item.to} search={{ challenge: undefined }} aria-label={t("create")} className="flex min-h-14 flex-1 flex-col items-center justify-center">
                  <span className={cn("grid size-11 place-items-center rounded-full", on ? "bg-accent text-accent-fg" : "bg-ink text-paper")}>
                    <Plus className="size-5" />
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={on ? "page" : undefined}
                className={cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs", on ? "text-accent" : "text-muted")}
              >
                <Icon className="size-5" strokeWidth={on ? 2.25 : 1.75} />
                {t(item.to === "/home" ? "home" : item.to === "/explore" ? "explore" : item.to === "/challenges" ? "challenges" : "profile")}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function BackButton({ fallback }: { fallback: "/home" | "/explore" | "/challenges" | "/profile" }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-label={t("back")}
      className="grid size-11 place-items-center rounded-full"
      onClick={() => {
        if (window.history.length > 1) router.history.back();
        else void router.navigate({ to: fallback });
      }}
    >
      <ChevronLeft className="size-5" />
    </button>
  );
}

export function TopBar({
  title,
  fallback,
  mark = false,
}: {
  title: string;
  fallback?: "/home" | "/explore" | "/challenges" | "/profile";
  mark?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-line bg-paper/90 pr-14 pl-2 backdrop-blur-md">
      {fallback ? <BackButton fallback={fallback} /> : mark ? <Mark className="ml-2 size-7" /> : null}
      <h1 className="font-display text-xl leading-none">{title}</h1>
    </header>
  );
}