import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mark, Wordmark } from "@/components/mark";
import { Button, Field, TextInput } from "@/components/ui";
import { authClient, authEnabled, GROK_PROVIDERS, rememberBearerToken, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
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

  if (!isPending && user) return <Navigate to="/home" />;

  async function onPhoto(file: File | undefined) {
    if (!file) {
      window.sessionStorage.removeItem("vti.pendingAvatar");
      return;
    }
    if (!isLikelyImage(file)) {
      setError("Use a JPG, PNG, or WebP photo.");
      return;
    }
    try {
      const data = await compressAvatar(file);
      window.sessionStorage.setItem("vti.pendingAvatar", data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that photo.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) {
      setError("Sign-in is not available right now.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (joining) {
        const name = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(name)) {
          setError("Usernames are 3–20 characters: letters, numbers, underscore.");
          setPending(false);
          return;
        }
        if (password.length < 8) {
          setError("Use at least 8 characters for the password.");
          setPending(false);
          return;
        }
        const result = await authClient.signUp.email({ email: email.trim(), password, name });
        if (result.error) {
          setError(result.error.message ?? "Could not create that account.");
          setPending(false);
          return;
        }
        rememberBearerToken(result.data?.token);
      } else {
        const result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) {
          setError(result.error.message ?? "Those details did not match.");
          setPending(false);
          return;
        }
        rememberBearerToken(result.data?.token);
      }
      await authClient.getSession();
      await navigate({ to: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-stone">
      <main className="stage px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-2">
          <Mark className="size-7" />
          <Wordmark />
        </Link>
        <h1 className="mt-8 font-display text-4xl leading-none">{joining ? "Create Account" : "Sign In"}</h1>
        <p className="mt-2 text-sm text-muted">
          {joining ? "A username, an email, and a password. A photo can wait — or drop a real one, or a character still." : "Welcome back. Your looks are where you left them."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={(e) => void submit(e)}>
          {joining ? (
            <Field label="Username" hint="This is how people find you.">
              <TextInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                required
              />
            </Field>
          ) : null}
          <Field label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Password" hint={joining ? "At least 8 characters." : undefined}>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={joining ? "new-password" : "current-password"}
              required
              minLength={8}
            />
          </Field>
          {joining ? (
            <Field label="Profile photo" hint="Optional. We crop it to a circle.">
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
            {pending ? "One moment…" : joining ? "Create Account" : "Sign In"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          {joining ? "Already have an account?" : "New here?"}{" "}
          <Link to="/login" search={{ mode: joining ? "enter" : "join" }} className="font-medium text-ink underline underline-offset-4">
            {joining ? "Sign In" : "Create Account"}
          </Link>
        </p>
        {authEnabled ? (
          <div className="mt-8 border-t border-line pt-5">
            <p className="text-xs text-muted">Or continue with</p>
            <div className="mt-3 flex flex-col gap-2">
              {GROK_PROVIDERS.map((p) => (
                <Button key={p.providerId} variant="line" className="w-full" onClick={() => void signIn(p.providerId, { callbackURL: "/home" })}>
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
