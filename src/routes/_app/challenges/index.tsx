import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, Field, LoadingBlock, TextArea, TextInput } from "@/components/ui";
import { countdown } from "@/lib/vti/format";
import { closeChallenge, createWeeklyChallenge, listChallenges } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/challenges/")({ component: ChallengesPage });

function ChallengesPage() {
  const query = useQuery("challenges", () => listChallenges());
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const board = query.data;
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="pb-nav">
      <TopBar title="Challenges" mark />
      {board?.season ? (
        <section className="gloss-card relative mx-4 mt-4 overflow-hidden rounded-[2rem] p-4">
          <img
            src={board.season.themeKey === "haunted" ? "/media/brand/haunted.jpg" : "/media/brand/lineup.jpg"}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div className="relative">
            <p className="text-xs tracking-widest text-gold uppercase">Monthly season</p>
            <h2 className="mt-1 font-display text-3xl leading-tight">{board.season.title}</h2>
            <p className="mt-2 text-sm text-ink">{board.season.tagline}</p>
            {board.season.published && board.season.podium.length ? (
              <ol className="mt-4 space-y-2">
                {board.season.podium.map((row) => (
                  <li key={row.place} className="flex items-center justify-between text-sm">
                    <span>{row.place === 1 ? "Monthly winner" : `${row.place} place`} · {row.username}</span>
                    <span className="tabular-nums text-muted">{row.points} pts · {row.weeklyWins} weekly wins</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-ink">Monthly ranking stays hidden until the season closes. One strong week is not enough on its own.</p>
            )}
          </div>
        </section>
      ) : null}
      <p className="px-4 pt-4 text-sm text-muted">
        Competitive votes are separate from likes. Each account gets 10 votes per challenge, cannot vote for itself, and cannot see the score until the round ends.
      </p>
      {query.loading ? <LoadingBlock label="Loading challenges" /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      <ul className="grid gap-4 px-4 py-4 lg:grid-cols-2">
        {board?.challenges.map((challenge) => (
          <li key={challenge.id}>
            <Link to="/challenges/$challengeId" params={{ challengeId: challenge.id }} className="ticket block overflow-hidden rounded-[2rem] border border-line">
              <img src={challenge.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
              <span className="block p-4">
                <span className="text-xs font-medium text-accent">
                  {challenge.phase === "ended" ? "Results published" : challenge.phase === "voting" ? "Voting open" : challenge.phase === "upcoming" ? "Soon" : "Submissions open"}
                  {" · "}{challenge.theme}
                </span>
                <span className="mt-1 block font-display text-2xl leading-tight">{challenge.title}</span>
                <span className="mt-2 block text-sm text-muted">{challenge.description}</span>
                <span className="mt-3 flex gap-4 text-xs text-muted tabular-nums">
                  <span>{challenge.participants} in</span>
                  <span>{challenge.phase === "ended" ? "Ended" : countdown(challenge.votingClose, now)}</span>
                </span>
              </span>
            </Link>
            {board.role === "founder" && challenge.phase !== "ended" ? (
              <button
                type="button"
                className="mt-2 text-xs text-muted underline underline-offset-4"
                onClick={() => {
                  void closeChallenge({ data: { id: challenge.id } }).then((res) => {
                    setNote(res.ok ? "Results published." : res.error);
                    if (res.ok) query.reload();
                  });
                }}
              >
                Close voting and publish results
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {board?.role === "founder" ? <FounderDesk onCreated={() => query.reload()} /> : null}
      {note ? <p className="px-4 pb-6 text-sm text-accent">{note}</p> : null}
    </div>
  );
}

function FounderDesk({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createWeeklyChallenge({
      data: { title, description, theme, submitDays: 5, voteDays: 2 },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTitle("");
    setDescription("");
    setTheme("");
    onCreated();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mx-4 mb-6 space-y-3 rounded-[2rem] border border-line p-4">
      <p className="text-xs tracking-widest text-gold uppercase">Founder desk</p>
      <h3 className="font-display text-2xl">Open a weekly challenge</h3>
      <Field label="Title"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
      <Field label="Theme"><TextInput value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="Haunted glam" /></Field>
      <Field label="Description"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} required /></Field>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit" disabled={busy}>Create challenge</Button>
    </form>
  );
}
