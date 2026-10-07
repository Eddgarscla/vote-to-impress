import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { LookCropper } from "@/components/cropper";
import { TopBar } from "@/components/shell";
import { Button, Field, TextArea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { isLikelyImage } from "@/lib/vti/image";
import { createPost, listChallenges } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";

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
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(search.challenge ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const exportRef = useRef<(() => Promise<string>) | null>(null);
  const active = (challenges.data ?? []).filter((c) => c.phase === "active");

  function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!isLikelyImage(file)) {
      setError("Use a JPG, PNG, WebP, or GIF.");
      return;
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(URL.createObjectURL(file));
  }

  async function publish() {
    if (!exportRef.current) {
      setError("Choose a photo first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const imageDataUrl = await exportRef.current();
      const res = await createPost({
        data: { imageDataUrl, caption, challengeId },
      });
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
        {!fileUrl ? (
          <label className="mx-4 flex aspect-[4/5] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 text-center">
            <span className="font-display text-2xl">Add a photo</span>
            <span className="mt-2 text-sm text-muted">JPG, PNG, WebP, or GIF. We frame it as a portrait. You can drag it into place.</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        ) : (
          <LookCropper src={fileUrl} exportRef={exportRef} />
        )}
        <div className="mt-4 space-y-4 px-4">
          <Field label="Caption">
            <TextArea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} rows={3} placeholder="What should people notice?" />
          </Field>
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Challenge</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChallengeId(null)}
                className={cn("h-10 rounded-full px-3 text-sm", challengeId === null ? "bg-ink text-paper" : "bg-chip text-ink")}
              >
                None
              </button>
              {active.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChallengeId(c.id)}
                  className={cn("h-10 rounded-full px-3 text-sm", challengeId === c.id ? "bg-ink text-paper" : "bg-chip text-ink")}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <Button className="w-full" disabled={pending || !fileUrl} onClick={() => void publish()}>
            {pending ? "Publishing…" : "Publish"}
          </Button>
          {fileUrl ? (
            <button type="button" className="text-sm text-muted underline underline-offset-4" onClick={() => { URL.revokeObjectURL(fileUrl); setFileUrl(null); }}>
              Choose a different photo
            </button>
          ) : null}
          <Link to="/look-pop" className="block text-sm underline underline-offset-4">Make your look pop</Link>
        </div>
      </div>
    </div>
  );
}
