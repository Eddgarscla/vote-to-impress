import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mark, Wordmark } from "@/components/mark";
import { Button, Field, TextInput } from "@/components/ui";
import { authClient, authEnabled, clearBearerToken, GROK_PROVIDERS, rememberBearerToken, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useI18n } from "@/lib/i18n";
import { compressAvatar, isLikelyImage } from "@/lib/vti/image";

type Search = { mode: "join" | "enter" };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search.mode === "enter" ? "enter" : "join",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const joining = mode === "join";
  const { t } = useI18n();

  if (!isPending && user) return <Navigate to="/home" />;

  async function onPhoto(file: File | undefined) {
    if (!file) {
      window.sessionStorage.removeItem("vti.pendingAvatar");
      return;
    }
    if (!isLikelyImage(file)) {
      setError(t("badPhoto"));
      return;
    }
    try {
      const data = await compressAvatar(file);
      window.sessionStorage.setItem("vti.pendingAvatar", data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("photoFailed"));
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const emailValue = String(form.get("email") ?? email).trim();
    const passwordValue = String(form.get("password") ?? password);
    if (!authEnabled) {
      setError(t("signInOff"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (joining) {
        const name = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(name)) {
          setError(t("usernameRule"));
          setPending(false);
          return;
        }
        if (passwordValue.length < 8) {
          setError(t("passwordShort"));
          setPending(false);
          return;
        }
        clearBearerToken();
        const result = await authClient.signUp.email({ email: emailValue, password: passwordValue, name });
        if (result.error) {
          setError(result.error.message ?? t("accountFailed"));
          setPending(false);
          return;
        }
        rememberBearerToken(result.data?.token);
      } else {
        if (!emailValue || passwordValue.length < 8) {
          setError(t("enterBoth"));
          setPending(false);
          return;
        }
        clearBearerToken();
        const result = await authClient.signIn.email({
          email: emailValue,
          password: passwordValue,
          rememberMe: true,
        });
        if (result.error) {
          const raw = result.error.message ?? t("mismatch");
          setError(/invalid email or password/i.test(raw) ? t("mismatch") : raw);
          setPending(false);
          return;
        }
        rememberBearerToken(result.data?.token);
      }
      await authClient.getSession();
      await navigate({ to: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("somethingWrong"));
      setPending(false);
    }
  }

  return (
    <div className="welcome-stage relative min-h-dvh overflow-hidden bg-stone">
      <div className="spark-field" aria-hidden="true" />
      <main className="stage relative px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-2">
          <Mark className="size-7" />
          <Wordmark />
        </Link>
        <h1 className="mt-8 font-display text-4xl leading-none">{joining ? t("createAccount") : t("signIn")}</h1>
        <p className="mt-2 text-sm text-muted">
          {joining ? t("joinBlurb") : t("welcomeBack")}
        </p>
        <form className="mt-6 space-y-4" onSubmit={(e) => void submit(e)}>
          {joining ? (
            <Field label={t("username")} hint={t("usernameHint")}>
              <TextInput
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                required
              />
            </Field>
          ) : null}
          <Field label={t("email")}>
            <TextInput
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </Field>
          <Field label={t("password")} hint={joining ? t("passwordHint") : t("staySigned")}>
            <TextInput
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={joining ? "new-password" : "current-password"}
              required
              minLength={8}
            />
          </Field>
          {joining ? (
            <Field label={t("profilePhoto")} hint={t("photoOptional")}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="block w-full text-sm"
                onChange={(e) => void onPhoto(e.target.files?.[0])}
              />
            </Field>
          ) : null}
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("oneMoment") : joining ? t("createAccount") : t("signIn")}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          {joining ? t("haveAccount") : t("newHere")}{" "}
          <Link to="/login" search={{ mode: joining ? "enter" : "join" }} className="font-medium text-ink underline underline-offset-4">
            {joining ? t("signIn") : t("createAccount")}
          </Link>
        </p>
        {authEnabled ? (
          <div className="mt-8 border-t border-line pt-5">
            <p className="text-xs text-muted">{t("continueWith")}</p>
            <div className="mt-3 flex flex-col gap-2">
              {GROK_PROVIDERS.map((p) => (
                <Button key={p.providerId} variant="line" className="w-full" onClick={() => void signIn(p.providerId, { callbackURL: "/home" })}>
                  {t("continueProvider")} {p.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
