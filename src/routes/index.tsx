import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Mark, Wordmark } from "@/components/mark";
import { useSessionBoot } from "@/lib/auth/use-session-boot";

export const Route = createFileRoute("/")({ component: Welcome });

function Welcome() {
  const boot = useSessionBoot();
  if (!boot.isPending && boot.user) return <Navigate to="/home" />;

  return (
    <div className="min-h-dvh bg-stone">
      <main className="stage flex min-h-dvh flex-col px-5 pt-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mark className="mark-glow size-8" />
            <Wordmark />
          </div>
          <span className="rounded-full border border-line bg-chip px-2.5 py-1 text-xs tracking-widest text-muted uppercase">Season 01</span>
        </div>

        <div className="panel look-frame relative mt-6 overflow-hidden rounded-3xl">
          <img
            src="/media/looks/noir-neon.jpg"
            alt=""
            className="aspect-[4/5] max-h-[46vh] w-full object-cover object-top"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-paper via-paper/70 to-transparent p-4">
            <p className="text-xs tracking-widest text-accent uppercase">The floor is open</p>
            <p className="font-display text-2xl leading-none">Show the look. Take the room.</p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-4xl leading-[0.95]">Vote to Impress</h1>
        <p className="mt-3 max-w-sm text-sm text-muted">
          A dark fashion floor for characters, looks, and weekly challenges. Publish a portrait, follow the room, and vote for who wears it best.
        </p>

        <div className="mt-auto flex flex-col gap-3 pt-8">
          {boot.isPending && !boot.stalled ? (
            <p className="text-center text-xs tracking-wide text-muted uppercase" role="status">Checking your pass…</p>
          ) : null}
          {boot.stalled || boot.error ? (
            <div className="rounded-2xl border border-line bg-chip px-4 py-3 text-sm" role="alert">
              <p>{boot.error ?? "The session check stalled. You can still create an account or sign in."}</p>
              <button type="button" className="mt-2 font-medium text-accent underline underline-offset-4" onClick={boot.retry}>
                Try again
              </button>
            </div>
          ) : null}
          <Link to="/login" search={{ mode: "join" }} className="btn-glow inline-flex h-12 items-center justify-center rounded-full text-sm font-semibold">
            Create Account
          </Link>
          <Link to="/login" search={{ mode: "enter" }} className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-surface text-sm font-medium text-ink">
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
