import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/avatar";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, LoadingBlock } from "@/components/ui";
import { compact } from "@/lib/vti/format";
import { getExplore, toggleFollow } from "@/lib/vti/server";
import type { PersonCard } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/explore")({ component: ExplorePage });

function ExplorePage() {
  const query = useQuery("explore", () => getExplore());
  const data = query.data;

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
    patchPerson(person.id, next, person.followers + (next ? 1 : -1));
    const res = await toggleFollow({ data: { userId: person.id } });
    if (!res.ok) {
      patchPerson(person.id, person.followedByMe, person.followers);
      return;
    }
    patchPerson(person.id, res.following, res.followers);
  }

  return (
    <div className="pb-nav">
      <TopBar title="Explore" mark />
      {query.loading ? <LoadingBlock label="Loading explore" /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {data ? (
        <div className="space-y-8 py-5">
          <section>
            <h2 className="px-4 font-display text-2xl">Recommended for you</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {data.recommended.map((person) => (
                <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                  <Link to="/u/$username" params={{ username: person.username }} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={person.avatarUrl} name={person.username} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{person.username}</span>
                      <span className="block truncate text-xs text-muted">{person.bio || `${compact(person.followers)} followers`}</span>
                    </span>
                  </Link>
                  <Button variant="primary" className="h-10 px-4" onClick={() => void onFollow(person)}>Follow</Button>
                </li>
              ))}
              {data.recommended.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No other players yet. The studio lookbook is sample art, not a live crowd.</li> : null}
            </ul>
          </section>
          <LookRail title="Studio lookbook" looks={data.lookbook} note="Sample looks from the studio. Not live players." />
          <section>
            <h2 className="px-4 font-display text-2xl">New users</h2>
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
          <LookRail title="Trending looks" looks={data.trending} />
          <section>
            <h2 className="px-4 font-display text-2xl">Recent challenge winners</h2>
            <ul className="mt-3 space-y-3 px-4">
              {data.winners.map((winner) => (
                <li key={winner.challengeId}>
                  <Link to="/challenges/$challengeId" params={{ challengeId: winner.challengeId }} className="flex gap-3">
                    <img src={winner.imageUrl} alt="" className="h-28 w-20 rounded-lg bg-chip object-cover" />
                    <span className="min-w-0 py-1">
                      <span className="block text-xs text-accent">1st place · {winner.points} pts</span>
                      <span className="mt-1 block font-display text-xl leading-tight">{winner.username}</span>
                      <span className="mt-1 block text-sm text-muted">{winner.challengeTitle}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {data.winners.length === 0 ? <li className="text-sm text-muted">Winners appear when a challenge closes.</li> : null}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function LookRail({ title, looks, note }: { title: string; looks: { id: string; imageUrl: string; username: string; likeCount: number }[]; note?: string }) {
  return (
    <section>
      <h2 className="px-4 font-display text-2xl">{title}</h2>
      {note ? <p className="px-4 pt-1 text-xs text-muted">{note}</p> : null}
      <ul className="rail mt-3 px-4 pb-1">
        {looks.map((look) => (
          <li key={look.id} className="w-36 shrink-0">
            <Link to="/p/$postId" params={{ postId: look.id }} className="block">
              <img src={look.imageUrl} alt="" className="aspect-[3/4] w-full rounded-lg bg-chip object-cover" />
              <span className="mt-1.5 block truncate text-xs font-medium">{look.username}</span>
              <span className="block text-xs text-muted tabular-nums">{compact(look.likeCount)} likes</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
