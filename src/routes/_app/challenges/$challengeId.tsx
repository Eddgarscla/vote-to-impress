import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, LoadingBlock } from "@/components/ui";
import { cn } from "@/lib/cn";
import { countdown, placeLabel, placeMedal, shortDate } from "@/lib/vti/format";
import { getChallenge, submitExistingPost, toggleVote } from "@/lib/vti/server";
import type { ChallengeDetail, RankedLook } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/challenges/$challengeId")({
  component: ChallengePage,
});

function ChallengePage() {
  const { challengeId } = Route.useParams();
  const query = useQuery(challengeId, () => getChallenge({ data: { id: challengeId } }));
  const detail = query.data;
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  async function onVote(entry: RankedLook) {
    if (!detail || !detail.canVote) return;
    setNote(null);
    setBusy(entry.submissionId);
    const res = await toggleVote({ data: { submissionId: entry.submissionId } });
    setBusy(null);
    if (!res.ok) {
      setNote(res.error);
      return;
    }
    const ranking = detail.ranking.map((row) =>
      row.submissionId === entry.submissionId ? { ...row, votedByMe: res.voted } : row,
    );
    query.setData({ ...detail, ranking, votesUsed: res.votesUsed, votesLeft: res.votesLeft });
  }

  async function onSubmit(postId: string) {
    setNote(null);
    setBusy(postId);
    const res = await submitExistingPost({ data: { postId, challengeId } });
    setBusy(null);
    if (!res.ok) {
      setNote(res.error);
      return;
    }
    query.reload();
  }

  return (
    <div className="pb-nav">
      <TopBar title="Challenge" fallback="/challenges" />
      {query.loading ? <LoadingBlock label="Loading challenge" /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {detail === null && !query.loading && !query.error ? <ErrorNote message="That challenge is not here." /> : null}
      {detail ? <ChallengeBody detail={detail} now={now} note={note} busy={busy} onVote={onVote} onSubmit={onSubmit} /> : null}
    </div>
  );
}

function ChallengeBody({
  detail,
  now,
  note,
  busy,
  onVote,
  onSubmit,
}: {
  detail: ChallengeDetail;
  now: number;
  note: string | null;
  busy: string | null;
  onVote: (entry: RankedLook) => void;
  onSubmit: (postId: string) => void;
}) {
  const ranking = detail.resultsPublic
    ? [...detail.ranking].sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
    : detail.ranking;
  const ended = detail.resultsPublic;

  return (
    <div>
      <img src={detail.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
      <div className="px-4 py-4">
        <p className="text-xs font-medium text-accent">
          {ended ? "Results" : detail.phase === "voting" ? "Voting" : detail.phase === "upcoming" ? "Soon" : "Live"} · {detail.theme}
        </p>
        <h2 className="mt-1 font-display text-3xl leading-tight">{detail.title}</h2>
        <p className="mt-2 text-sm text-muted">{detail.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Starts</dt>
            <dd>{shortDate(detail.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Ends</dt>
            <dd className="tabular-nums">{ended ? "Ended" : countdown(detail.votingClose, now)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Participants</dt>
            <dd className="tabular-nums">{detail.participants}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Votes left</dt>
            <dd className="tabular-nums">{detail.canVote ? `${detail.votesLeft} of ${detail.voteBudget}` : ended ? "Closed" : "Not open"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          {ended
            ? "Scores are public now. Likes never counted."
            : "Scores, ranks, and vote totals stay hidden until voting closes. A like is not a competitive vote."}
        </p>
      </div>

      <section className="border-t border-line px-4 py-4">
        <h3 className="font-display text-2xl">{ended ? "Final ranking" : "Looks in this challenge"}</h3>
        {ranking.length === 0 ? <p className="mt-3 text-sm text-muted">No looks yet. Be the first.</p> : null}
        <ol className="mt-3 space-y-4">
          {ranking.map((entry) => {
            const mine = entry.submissionId === detail.mySubmissionId;
            const medal = ended && entry.place ? placeMedal(entry.place) : "";
            return (
              <li key={entry.submissionId} className="panel overflow-hidden rounded-[2rem] border border-line">
                <Link to="/p/$postId" params={{ postId: entry.postId }} className="block">
                  <img src={entry.imageUrl} alt="" className="aspect-[4/5] w-full object-cover" />
                </Link>
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    {ended && entry.place ? (
                      <p className="text-sm font-medium">
                        {medal ? <span className="mr-1">{medal}</span> : null}
                        {placeLabel(entry.place)}
                        {entry.pointsLabel ? <span className="ml-2 text-muted">{entry.pointsLabel}</span> : null}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">Score hidden</p>
                    )}
                    <Link to="/u/$username" params={{ username: entry.username }} className="mt-1 flex items-center gap-2">
                      <Avatar src={entry.avatarUrl} name={entry.username} size="sm" />
                      <span className="truncate text-sm">{entry.username}</span>
                    </Link>
                  </div>
                  {!detail.canVote ? null : mine ? (
                    <span className="text-xs text-muted">Your look</span>
                  ) : (
                    <Button
                      variant={entry.votedByMe ? "line" : "primary"}
                      className={cn("h-10 px-4", !entry.votedByMe && "vote-token border-0")}
                      disabled={busy === entry.submissionId}
                      onClick={() => onVote(entry)}
                    >
                      {entry.votedByMe ? "Vote cast" : "Competitive vote"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {detail.canSubmit && !detail.mySubmissionId ? (
        <section className="border-t border-line px-4 py-4">
          <h3 className="font-display text-2xl">Participate</h3>
          <p className="mt-1 text-sm text-muted">Submit one look. You can publish a new one or use a look that is not in a challenge yet.</p>
          <Link
            to="/create"
            search={{ challenge: detail.id }}
            className="mt-3 inline-flex h-12 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper"
          >
            Create a look for this
          </Link>
          {detail.eligiblePosts.length ? (
            <ul className="rail mt-4">
              {detail.eligiblePosts.map((post) => (
                <li key={post.id} className="w-28 shrink-0">
                  <img src={post.imageUrl} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium underline underline-offset-4"
                    disabled={busy === post.id}
                    onClick={() => onSubmit(post.id)}
                  >
                    Submit
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {detail.mySubmissionId && !ended ? <p className="px-4 pb-6 text-sm text-muted">You are in. One look per challenge.</p> : null}
      {note ? <p className="px-4 pb-6 text-sm text-accent">{note}</p> : null}
    </div>
  );
}
