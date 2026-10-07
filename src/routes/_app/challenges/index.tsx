import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/shell";
import { ErrorNote, LoadingBlock } from "@/components/ui";
import { countdown } from "@/lib/vti/format";
import { listChallenges } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/challenges/")({ component: ChallengesPage });

function ChallengesPage() {
  const query = useQuery("challenges", () => listChallenges());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="pb-nav">
      <TopBar title="Challenges" mark />
      <p className="px-4 pt-4 text-sm text-muted">Themed rounds. One look each. 1st earns 100 Impress Points, 2nd 75, 3rd 50.</p>
      {query.loading ? <LoadingBlock label="Loading challenges" /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      <ul className="space-y-4 px-4 py-4">
        {query.data?.map((challenge) => (
          <li key={challenge.id}>
            <Link to="/challenges/$challengeId" params={{ challengeId: challenge.id }} className="panel block overflow-hidden rounded-3xl border border-line">
              <img src={challenge.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
              <span className="block p-4">
                <span className="text-xs font-medium text-accent">{challenge.phase === "active" ? "Live" : "Closed"} · {challenge.theme}</span>
                <span className="mt-1 block font-display text-2xl leading-tight">{challenge.title}</span>
                <span className="mt-2 block text-sm text-muted">{challenge.description}</span>
                <span className="mt-3 flex gap-4 text-xs text-muted tabular-nums">
                  <span>{challenge.participants} in</span>
                  <span>{challenge.phase === "ended" ? "Ended" : countdown(challenge.endDate, now)}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
