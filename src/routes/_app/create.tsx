import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { LookCropper } from "@/components/cropper";
import { TopBar } from "@/components/shell";
import { Button, Field, TextArea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { isLikelyImage } from "@/lib/vti/image";
import { createPost, listChallenges } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";

const MAX_PHOTOS = 24;

export const Route = createFileRoute("/_app/create")({
  validateSearch: (search: Record<string, unknown>) => ({
    challenge: typeof search.challenge === "string" && search.challenge ? search.challenge : undefined,
  }),
  component: CreatePage,
});

function CreatePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const challenges = useQuery("create-challenges", () => listChallenges());
  const [queue, setQueue] = useState<string[]>([]);
  const [shots, setShots] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(search.challenge ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const exportRef = useRef<(() => Promise<string>) | null>(null);
  const active = (challenges.data?.challenges ?? []).filter((c) => c.phase === "open");
  const current = queue[0] ?? null;

  function onFiles(list: FileList | null) {
    setError(null);
    if (!list?.length) return;
    const room = MAX_PHOTOS - shots.length - queue.length;
    if (room <= 0) {
      setError(`This post can hold ${MAX_PHOTOS} photos. That is the storage ceiling for one look, not a small gallery limit.`);
      return;
    }
    const next: string[] = [];
    for (const file of Array.from(list).slice(0, room)) {
      if (!isLikelyImage(file)) {
        setError("Use JPG, PNG, WebP, or GIF.");
        continue;
      }
      next.push(URL.createObjectURL(file));
    }
    setQueue((prev) => [...prev, ...next]);
  }

  async function keepCurrent() {
    if (!exportRef.current) return;
    const data = await exportRef.current();
    setShots((prev) => [...prev, data]);
    setQueue((prev) => {
      const [first, ...rest] = prev;
      if (first) URL.revokeObjectURL(first);
      return rest;
    });
  }

  async function publish() {
    setPending(true);
    setError(null);
    try {
      const imageDataUrls = [...shots];
      if (current && exportRef.current) imageDataUrls.push(await exportRef.current());
      if (!imageDataUrls.length) {
        setError("Add at least one photo.");
        setPending(false);
        return;
      }
      const res = await createPost({ data: { imageDataUrls, caption, challengeId } });
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }
      if (res.challengeId) await navigate({ to: "/challenges/$challengeId", params: { challengeId: res.challengeId } });
      else await navigate({ to: "/p/$postId", params: { postId: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish.");
      setPending(false);
    }
  }

  return (
    <div className="pb-nav">
      <TopBar title="New look" mark />
      <div className="py-4">
        {current ? <LookCropper src={current} exportRef={exportRef} /> : (
          <label className="mx-4 flex aspect-[4/5] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 text-center">
            <span className="font-display text-2xl">Add photos</span>
            <span className="mt-2 text-sm text-muted">Choose one or many. Each photo is framed, then they stay in the same post.</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
          </label>
        )}
        <div className="mt-4 space-y-4 px-4">
          {shots.length ? (
            <ul className="rail">
              {shots.map((shot, index) => (
                <li key={shot.slice(0, 32) + index} className="w-20 shrink-0">
                  <img src={shot} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted">{shots.length + (current ? 1 : 0)} photo{shots.length + (current ? 1 : 0) === 1 ? "" : "s"} in this post.</p>
          {current ? (
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="line" onClick={() => void keepCurrent()}>Add this photo</Button>
              <label className="inline-flex h-12 cursor-pointer items-center text-sm underline underline-offset-4">
                Add more files
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
              </label>
            </div>
          ) : null}
          <Field label="Caption">
            <TextArea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} rows={3} placeholder="What should people notice?" />
          </Field>
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Challenge</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setChallengeId(null)} className={cn("h-10 rounded-full px-3 text-sm", challengeId === null ? "bg-ink text-paper" : "bg-chip text-ink")}>None</button>
              {active.map((c) => (
                <button key={c.id} type="button" onClick={() => setChallengeId(c.id)} className={cn("h-10 rounded-full px-3 text-sm", challengeId === c.id ? "bg-ink text-paper" : "bg-chip text-ink")}>
                  {c.kind === "monthly" ? "Month · " : "Week · "}{c.title}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <Button className="w-full" disabled={pending || (!current && shots.length === 0)} onClick={() => void publish()}>
            {pending ? "Publishing…" : "Publish"}
          </Button>
          <Link to="/look-pop" className="block text-sm underline underline-offset-4">Make your look pop</Link>
        </div>
      </div>
    </div>
  );
}
