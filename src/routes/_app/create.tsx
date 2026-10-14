import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { LookGallery } from "@/components/gallery";
import { LookCropper } from "@/components/cropper";
import { TopBar } from "@/components/shell";
import { Button, Field, TextArea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { announce, useI18n } from "@/lib/i18n";
import { compressLook, isLikelyImage } from "@/lib/vti/image";
import { createPost, listChallenges } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";

const MAX_PHOTOS = 24;

type Shot = { id: string; url: string; file: File | null };

function kindLabel(kind: string, day: string, month: string, week: string) {
  if (kind === "daily") return day;
  if (kind === "monthly") return month;
  return week;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/_app/create")({
  validateSearch: (search: Record<string, unknown>) => ({
    challenge: typeof search.challenge === "string" && search.challenge ? search.challenge : undefined,
  }),
  component: CreatePage,
});

function CreatePage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const challenges = useQuery("create-challenges", () => listChallenges());
  const [shots, setShots] = useState<Shot[]>([]);
  const [caption, setCaption] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(search.challenge ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [framing, setFraming] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const exportRef = useRef<(() => Promise<string>) | null>(null);
  const active = (challenges.data?.challenges ?? []).filter((c) => c.phase === "open");
  const framingShot = shots.find((shot) => shot.id === framing) ?? null;

  function onFiles(list: FileList | null) {
    setError(null);
    if (!list?.length) return;
    const room = MAX_PHOTOS - shots.length;
    if (room <= 0) {
      setError(t("photoLimit"));
      return;
    }
    const next: Shot[] = [];
    for (const file of Array.from(list)) {
      if (next.length >= room) break;
      if (!isLikelyImage(file)) {
        setError(t("badFiles"));
        continue;
      }
      next.push({ id: crypto.randomUUID(), url: URL.createObjectURL(file), file });
    }
    if (next.length) setShots((prev) => [...prev, ...next]);
  }

  function removeShot(id: string) {
    setShots((prev) => {
      const shot = prev.find((item) => item.id === id);
      if (shot?.url.startsWith("blob:")) URL.revokeObjectURL(shot.url);
      return prev.filter((item) => item.id !== id);
    });
  }

  function moveShot(id: string, dir: -1 | 1) {
    setShots((prev) => {
      const index = prev.findIndex((shot) => shot.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  function dropOn(id: string) {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === id) return;
    setShots((prev) => {
      const copy = [...prev];
      const fromIndex = copy.findIndex((shot) => shot.id === from);
      const toIndex = copy.findIndex((shot) => shot.id === id);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy;
    });
  }

  async function publish() {
    setPending(true);
    setError(null);
    try {
      if (!shots.length) {
        setError(t("needPhoto"));
        setPending(false);
        return;
      }
      const imageDataUrls: string[] = [];
      for (const shot of shots) {
        if (shot.file?.type === "image/gif") imageDataUrls.push(await readFile(shot.file));
        else if (shot.url.startsWith("data:")) imageDataUrls.push(shot.url);
        else imageDataUrls.push(await compressLook(shot.url));
      }
      const res = await createPost({ data: { imageDataUrls, caption, challengeId } });
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }
      if (res.challengeId) {
        announce(t("entered"));
        await navigate({ to: "/challenges/$challengeId", params: { challengeId: res.challengeId } });
      } else {
        announce(t("published"));
        await navigate({ to: "/p/$postId", params: { postId: res.id } });
      }
    } catch (e) {
      setError(e instanceof Error ? (e.message === "read" ? t("readFail") : e.message) : t("publishFail"));
      setPending(false);
    }
  }

  return (
    <div className="pb-nav">
      <TopBar title={t("newLook")} mark />
      <div className="space-y-4 px-4 py-4">
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 py-6 text-center">
          <span className="font-display text-2xl">{shots.length ? t("addMorePhotos") : t("addPhotos")}</span>
          <span className="mt-2 text-sm text-muted">{t("photoHelp")}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-sm text-muted">{shots.length} / {MAX_PHOTOS} {t("selectedOf")}</p>
        {shots.length ? (
          <>
            <LookGallery images={shots.map((shot) => shot.url)} alt={t("addPhotos")} />
            <ul className="grid grid-cols-3 gap-2">
              {shots.map((shot, index) => (
                <li
                  key={shot.id}
                  draggable
                  onDragStart={() => {
                    dragId.current = shot.id;
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropOn(shot.id)}
                  className="rounded-2xl bg-chip p-1"
                >
                  <img src={shot.url} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
                  <div className="mt-1 flex items-center justify-between gap-1 text-xs">
                    <span className="tabular-nums text-muted">{index + 1}</span>
                    <button type="button" className="underline" onClick={() => moveShot(shot.id, -1)} aria-label={`${t("up")} ${index + 1}`}>{t("up")}</button>
                    <button type="button" className="underline" onClick={() => moveShot(shot.id, 1)} aria-label={`${t("down")} ${index + 1}`}>{t("down")}</button>
                    <button type="button" className="underline" onClick={() => setFraming(shot.id)}>{t("frame")}</button>
                    <button type="button" className="text-accent underline" onClick={() => removeShot(shot.id)} aria-label={`${t("remove")} ${index + 1}`}>{t("remove")}</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {framingShot ? (
          <div>
            <p className="mb-2 text-sm">{t("frameHint")}</p>
            <LookCropper src={framingShot.url} exportRef={exportRef} />
            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                variant="line"
                onClick={() => {
                  void (async () => {
                    if (!exportRef.current) return;
                    const dataUrl = await exportRef.current();
                    setShots((prev) => prev.map((shot) => shot.id === framingShot.id ? { ...shot, url: dataUrl, file: null } : shot));
                    if (framingShot.url.startsWith("blob:")) URL.revokeObjectURL(framingShot.url);
                    setFraming(null);
                  })();
                }}
              >
                {t("useFrame")}
              </Button>
              <button type="button" className="text-sm underline" onClick={() => setFraming(null)}>{t("leaveFrame")}</button>
            </div>
          </div>
        ) : null}
        <Field label={t("caption")}>
          <TextArea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} rows={3} placeholder={t("captionHint")} />
        </Field>
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{t("challengePick")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setChallengeId(null)} className={cn("h-10 rounded-full px-3 text-sm", challengeId === null ? "bg-ink text-paper" : "bg-chip text-ink")}>{t("none")}</button>
            {active.map((c) => (
              <button key={c.id} type="button" onClick={() => setChallengeId(c.id)} className={cn("h-10 rounded-full px-3 text-sm", challengeId === c.id ? "bg-ink text-paper" : "bg-chip text-ink")}>
                {kindLabel(c.kind, t("day"), t("monthShort"), t("weekShort"))} · {c.title}
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <Button className="w-full" disabled={pending || shots.length === 0} onClick={() => void publish()}>
          {pending ? t("publishing") : t("publishPost")}
        </Button>
        <Link to="/look-pop" className="block text-sm underline underline-offset-4">{t("lookPopLink")}</Link>
      </div>
    </div>
  );
}
