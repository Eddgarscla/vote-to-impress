import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/shell";
import { ErrorNote, LoadingBlock } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { countdown } from "@/lib/vti/format";
import { closeChallenge, listChallenges } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/challenges/")({ component: ChallengesPage });

function phaseLabel(phase: string, t: ReturnType<typeof useI18n>["t"]) {
  if (phase === "ended") return t("phaseResults");
  if (phase === "voting") return t("phaseVoting");
  if (phase === "upcoming") return t("phaseSoon");
  if (phase === "paused") return t("phasePaused");
  return t("phaseOpen");
}

function kindLabel(kind: string, t: ReturnType<typeof useI18n>["t"]) {
  if (kind === "daily") return t("daily");
  if (kind === "monthly") return t("monthly");
  return t("weeklyKind");
}

function ChallengesPage() {
  const { t, lang } = useI18n();
  const query = useQuery("challenges", () => listChallenges());
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const board = query.data;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="pb-nav">
      <TopBar title={t("challenges")} mark />
      {board?.season ? (
        <section className="gloss-card relative mx-4 mt-4 overflow-hidden rounded-[2rem] p-4">
          <img
            src={board.season.themeKey === "haunted" ? "/media/brand/haunted.jpg" : "/media/brand/lineup.jpg"}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="relative">
            <p className="text-xs tracking-widest text-gold uppercase">{t("monthlySeason")}</p>
            <h2 className="mt-1 font-display text-3xl leading-tight">{board.season.title}</h2>
            <p className="mt-2 text-sm text-ink">{board.season.tagline}</p>
            {board.season.published && board.season.podium.length ? (
              <ol className="mt-4 space-y-2">
                {board.season.podium.map((row) => (
                  <li key={row.place} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {row.place === 1 ? t("monthlyWinner") : `${row.place} ${t("placeWord")}`} · {row.username}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{row.points} {t("pts")} · {row.weeklyWins} {t("weeklyWinsShort")}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-ink">{t("seasonHidden")}</p>
            )}
          </div>
        </section>
      ) : null}
      <p className="px-4 pt-4 text-sm text-muted">{t("votesExplain")}</p>
      {query.loading ? <LoadingBlock label={t("loadingChallenges")} /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      <ul className="grid gap-4 px-4 py-4 lg:grid-cols-2">
        {board?.challenges.map((challenge) => (
          <li key={challenge.id}>
            <Link to="/challenges/$challengeId" params={{ challengeId: challenge.id }} className="ticket block overflow-hidden rounded-[2rem] border border-line">
              <img src={challenge.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
              <span className="block p-4">
                <span className="text-xs font-medium text-accent">
                  {kindLabel(challenge.kind, t)}
                  {" · "}
                  {phaseLabel(challenge.phase, t)}
                  {" · "}
                  {challenge.theme}
                </span>
                <span className="mt-1 block font-display text-2xl leading-tight">{challenge.title}</span>
                <span className="mt-2 block text-sm text-muted">{challenge.description}</span>
                <span className="mt-3 flex gap-4 text-xs text-muted tabular-nums">
                  <span>{challenge.participants} {t("inCount")}</span>
                  <span>{challenge.phase === "ended" ? t("ended") : countdown(challenge.votingClose, now, lang)}</span>
                </span>
              </span>
            </Link>
            {board.role === "founder" && challenge.phase !== "ended" ? (
              <button
                type="button"
                className="mt-2 text-xs text-muted underline underline-offset-4"
                onClick={() => {
                  void closeChallenge({ data: { id: challenge.id } }).then((res) => {
                    setNote(res.ok ? t("resultsPublished") : res.error);
                    if (res.ok) query.reload();
                  });
                }}
              >
                {t("closePublish")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {note ? <p className="px-4 pb-6 text-sm text-accent">{note}</p> : null}
    </div>
  );
}
