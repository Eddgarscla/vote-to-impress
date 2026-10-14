import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, LoadingBlock } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { compact } from "@/lib/vti/format";
import { getExplore, toggleFollow } from "@/lib/vti/server";
import type { PersonCard } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/explore")({ component: ExplorePage });

function ExplorePage() {
  const { t } = useI18n();
  const query = useQuery("explore", () => getExplore());
  const data = query.data;
  const [flash, setFlash] = useState<string | null>(null);

  function patchPerson(id: string, following: boolean, followers: number) {
    if (!data) return;
    const map = (list: PersonCard[]) => list.map((p) => (p.id === id ? { ...p, followedByMe: following, followers } : p));
    query.setData({
      ...data,
      recommended: following ? data.recommended.filter((p) => p.id !== id) : map(data.recommended),
      newUsers: map(data.newUsers),
    });
  }

  async function onFollow(person: PersonCard) {
    const next = !person.followedByMe;
    if (next) setFlash(person.id);
    patchPerson(person.id, next, person.followers + (next ? 1 : -1));
    const res = await toggleFollow({ data: { userId: person.id } });
    if (!res.ok) {
      setFlash(null);
      patchPerson(person.id, person.followedByMe, person.followers);
      return;
    }
    patchPerson(person.id, res.following, res.followers);
  }

  return (
    <div className="pb-nav">
      <TopBar title={t("explore")} mark />
      {query.loading ? <LoadingBlock label={t("loadingExplore")} /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {data ? (
        <div className="space-y-8 py-5">
          <section>
            <h2 className="px-4 font-display text-2xl">{t("recommended")}</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {data.recommended.map((person) => (
                <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                  <Link to="/u/$username" params={{ username: person.username }} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={person.avatarUrl} name={person.username} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{person.username}</span>
                      <span className="block truncate text-xs text-muted">{person.bio || `${compact(person.followers)} ${t("followers")}`}</span>
                    </span>
                  </Link>
                  <Button variant="primary" className={flash === person.id ? "follow-pop h-10 px-4" : "h-10 px-4"} onClick={() => void onFollow(person)}>
                    {t("follow")}
                  </Button>
                </li>
              ))}
              {data.recommended.length === 0 ? <li className="px-4 py-6 text-sm text-muted">{t("noPlayers")}</li> : null}
            </ul>
          </section>
          <LookRail title={t("studioLookbook")} looks={data.lookbook} note={t("studioNote")} />
          <section>
            <h2 className="px-4 font-display text-2xl">{t("newUsers")}</h2>
            <ul className="rail mt-3 px-4 pb-1">
              {data.newUsers.map((person) => (
                <li key={person.id} className="w-28 shrink-0">
                  <Link to="/u/$username" params={{ username: person.username }} className="block text-center">
                    <Avatar src={person.avatarUrl} name={person.username} size="lg" className="mx-auto" />
                    <span className="mt-2 block truncate text-xs font-medium">{person.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <LookRail title={t("trendingLooks")} looks={data.trending} />
          <section>
            <h2 className="px-4 font-display text-2xl">{t("recentWinners")}</h2>
            <ul className="mt-3 space-y-3 px-4">
              {data.winners.map((winner) => (
                <li key={winner.challengeId}>
                  <Link to="/challenges/$challengeId" params={{ challengeId: winner.challengeId }} className="panel flex gap-3 rounded-2xl p-2">
                    <img src={winner.imageUrl} alt="" className="look-frame h-28 w-20 rounded-xl bg-chip object-cover" />
                    <span className="min-w-0 py-1">
                      <span className="block text-xs text-accent">1 · {winner.points} {t("pts")}</span>
                      <span className="mt-1 block font-display text-xl leading-tight">{winner.username}</span>
                      <span className="mt-1 block text-sm text-muted">{winner.challengeTitle}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {data.winners.length === 0 ? <li className="text-sm text-muted">{t("winnersEmpty")}</li> : null}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function LookRail({ title, looks, note }: { title: string; looks: { id: string; imageUrl: string; username: string; likeCount: number }[]; note?: string }) {
  const { t } = useI18n();
  return (
    <section>
      <h2 className="px-4 font-display text-2xl">{title}</h2>
      {note ? <p className="px-4 pt-1 text-xs text-muted">{note}</p> : null}
      <ul className="rail mt-3 px-4 pb-1">
        {looks.map((look) => (
          <li key={look.id} className="w-36 shrink-0">
            <Link to="/p/$postId" params={{ postId: look.id }} className="block">
              <img src={look.imageUrl} alt="" className="look-frame aspect-[3/4] w-full rounded-2xl bg-chip object-cover" />
              <span className="mt-1.5 block truncate text-xs font-medium">{look.username}</span>
              <span className="block text-xs text-muted tabular-nums">{compact(look.likeCount)} {t("likesWord")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
