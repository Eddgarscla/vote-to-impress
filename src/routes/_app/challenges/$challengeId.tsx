import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, LoadingBlock } from "@/components/ui";
import { cn } from "@/lib/cn";
import { announce, useI18n } from "@/lib/i18n";
import { countdown, placeLabel, placeMedal, shortDate } from "@/lib/vti/format";
import { formatVoteWait } from "@/lib/vti/wallet";
import { getChallenge, submitExistingPost, toggleVote } from "@/lib/vti/server";
import type { ChallengeDetail, RankedLook } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/challenges/$challengeId")({
  component: ChallengePage,
});

function ChallengePage() {
  const { t, lang } = useI18n();
  const { challengeId } = Route.useParams();
  const query = useQuery(challengeId, () => getChallenge({ data: { id: challengeId } }));
  const detail = query.data;
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
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
    if (res.voted) {
      setFlashId(entry.submissionId);
      announce(t("voteCast"));
      window.setTimeout(() => setFlashId((current) => (current === entry.submissionId ? null : current)), 700);
    }
    const ranking = detail.ranking.map((row) =>
      row.submissionId === entry.submissionId ? { ...row, votedByMe: res.voted } : row,
    );
    query.setData({
      ...detail,
      ranking,
      votesUsed: res.votesUsed,
      votesLeft: res.votesLeft,
      wallet: res.wallet ?? detail.wallet,
    });
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
    announce(t("entered"));
    query.reload();
  }

  return (
    <div className="pb-nav">
      <TopBar title={t("challenge")} fallback="/challenges" />
      {query.loading ? <LoadingBlock label={t("loadingChallenge")} /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {detail === null && !query.loading && !query.error ? <ErrorNote message={t("missingChallenge")} /> : null}
      {detail ? (
        <ChallengeBody
          detail={detail}
          now={now}
          note={note}
          busy={busy}
          flashId={flashId}
          onVote={onVote}
          onSubmit={onSubmit}
        />
      ) : null}
    </div>
  );
}

function kindName(kind: string, t: ReturnType<typeof useI18n>["t"]) {
  if (kind === "daily") return t("daily");
  if (kind === "monthly") return t("monthly");
  return t("weeklyKind");
}

function ChallengeBody({
  detail,
  now,
  note,
  busy,
  flashId,
  onVote,
  onSubmit,
}: {
  detail: ChallengeDetail;
  now: number;
  note: string | null;
  busy: string | null;
  flashId: string | null;
  onVote: (entry: RankedLook) => void;
  onSubmit: (postId: string) => void;
}) {
  const { t, lang } = useI18n();
  const ranking = detail.resultsPublic
    ? [...detail.ranking].sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
    : detail.ranking;
  const ended = detail.resultsPublic;
  const phase = ended ? t("resultsWord") : detail.phase === "voting" ? t("votingWord") : detail.phase === "upcoming" ? t("soon") : t("live");

  return (
    <div>
      <img src={detail.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
      <div className="px-4 py-4">
        <p className="text-xs font-medium text-accent">
          {kindName(detail.kind, t)} · {phase} · {detail.theme}
        </p>
        <h2 className="mt-1 font-display text-3xl leading-tight">{detail.title}</h2>
        <p className="mt-2 text-sm text-muted">{detail.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">{t("starts")}</dt>
            <dd>{shortDate(detail.startDate, lang)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("endsLabel")}</dt>
            <dd className="tabular-nums">{ended ? t("ended") : countdown(detail.votingClose, now, lang)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("participants")}</dt>
            <dd className="tabular-nums">{detail.participants}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("votesWord")}</dt>
            <dd className="tabular-nums">
              {detail.canVote ? <VoteMeter detail={detail} now={now} /> : ended ? t("closed") : t("notOpen")}
            </dd>
          </div>
        </dl>
        {detail.stages.length ? (
          <ol className="mt-4 space-y-2">
            {detail.stages.map((stage) => (
              <li key={stage.id} className="panel rounded-2xl border border-line px-3 py-2 text-sm">
                <p className="font-medium">{stage.title}{stage.open ? ` · ${t("openNow")}` : ""}</p>
                <p className="text-muted">{stage.description}</p>
                {stage.requirement ? <p className="text-muted">{stage.requirement}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
        {detail.twists.map((twist) => (
          <aside key={twist.id} className="panel mt-4 rounded-2xl border border-line p-3">
            <p className="text-xs tracking-widest text-gold uppercase">{t("twistDrop")}</p>
            <p className="font-display text-xl">{twist.title}</p>
            <p className="text-sm">{twist.description}</p>
            {twist.requirement ? <p className="mt-1 text-sm text-muted">{twist.requirement}</p> : null}
            {twist.imageUrl ? <img src={twist.imageUrl} alt="" className="mt-2 aspect-video w-full rounded-xl object-cover" /> : null}
          </aside>
        ))}
        <p className="mt-3 text-xs text-muted">{ended ? t("scoresPublic") : t("scoresHidden")}</p>
      </div>

      <section className="border-t border-line px-4 py-4">
        <h3 className="font-display text-2xl">{ended ? t("finalRanking") : t("looksHere")}</h3>
        {ranking.length === 0 ? <p className="mt-3 text-sm text-muted">{t("noLooksYet")}</p> : null}
        <ol className="mt-3 space-y-4">
          {ranking.map((entry) => {
            const mine = entry.submissionId === detail.mySubmissionId;
            const medal = ended && entry.place ? placeMedal(entry.place) : "";
            return (
              <li key={entry.submissionId} className="panel overflow-hidden rounded-[2rem] border border-line">
                <Link to="/p/$postId" params={{ postId: entry.postId }} className="block">
                  <img src={entry.imageUrl} alt="" className="aspect-[4/5] w-full object-cover" />
                </Link>
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    {ended && entry.place ? (
                      <p className="text-sm font-medium">
                        {medal ? <span className="mr-1">{medal}</span> : null}
                        {placeLabel(entry.place, lang)}
                        {entry.pointsLabel ? <span className="ml-2 text-muted">{entry.pointsLabel}</span> : null}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">{t("scoreHidden")}</p>
                    )}
                    <Link to="/u/$username" params={{ username: entry.username }} className="mt-1 flex items-center gap-2">
                      <Avatar src={entry.avatarUrl} name={entry.username} size="sm" />
                      <span className="truncate text-sm">{entry.username}</span>
                    </Link>
                  </div>
                  {!detail.canVote ? null : mine ? (
                    <span className="text-xs text-muted">{t("yourLook")}</span>
                  ) : (
                    <Button
                      variant={entry.votedByMe ? "line" : "primary"}
                      className={cn("h-11 w-full px-4 sm:w-auto", !entry.votedByMe && "vote-token border-0", flashId === entry.submissionId && "vote-flash")}
                      disabled={busy === entry.submissionId}
                      onClick={() => onVote(entry)}
                    >
                      {entry.votedByMe ? t("voteCastBtn") : t("competitiveVote")}
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
          <h3 className="font-display text-2xl">{t("participate")}</h3>
          <p className="mt-1 text-sm text-muted">{t("oneLookStage")}</p>
          <Link
            to="/create"
            search={{ challenge: detail.id }}
            className="btn-glow mt-3 inline-flex h-12 items-center rounded-full px-5 text-sm font-medium"
          >
            {t("createForThis")}
          </Link>
          {detail.eligiblePosts.length ? (
            <ul className="rail mt-4">
              {detail.eligiblePosts.map((post) => (
                <li key={post.id} className="w-28 shrink-0">
                  <img src={post.imageUrl} alt="" className="look-frame aspect-[3/4] w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium underline underline-offset-4"
                    disabled={busy === post.id}
                    onClick={() => onSubmit(post.id)}
                  >
                    {t("submit")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {detail.mySubmissionId && !ended ? (
        <p className="px-4 pb-6 text-sm text-muted">
          {t("youAreIn")}{detail.openStageId ? ` ${t("forThisStage")}` : ""}.
        </p>
      ) : null}
      {note ? <p className="px-4 pb-6 text-sm text-accent">{note}</p> : null}
    </div>
  );
}

function VoteMeter({ detail, now }: { detail: ChallengeDetail; now: number }) {
  const { lang } = useI18n();
  const [seenAt] = useState(() => Date.now());
  const left = detail.wallet?.nextInMs == null ? null : Math.max(0, detail.wallet.nextInMs - (now - seenAt));
  const balance = detail.wallet?.balance ?? detail.votesLeft;
  const max = detail.wallet?.max ?? detail.voteBudget;
  return (
    <span>
      {balance}/{max}
      {balance < max ? ` · ${formatVoteWait(left, lang)}` : ""}
    </span>
  );
}
