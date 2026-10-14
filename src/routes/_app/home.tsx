import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mark, Wordmark } from "@/components/mark";
import { PostCard } from "@/components/post-card";
import { ErrorNote, LoadingBlock } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getFeed, toggleLike } from "@/lib/vti/server";
import type { PostCard as Post } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/home")({ component: HomePage });

function HomePage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"foryou" | "following">("foryou");
  const query = useQuery(mode, () => getFeed({ data: { mode } }));
  const posts = query.data;

  async function onLike(post: Post) {
    if (!posts) return;
    const liked = !post.likedByMe;
    const next = posts.map((p) =>
      p.id === post.id ? { ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) } : p,
    );
    query.setData(next);
    const res = await toggleLike({ data: { postId: post.id } });
    if (!res.ok) {
      query.setData(posts);
      return;
    }
    query.setData(next.map((p) => (p.id === post.id ? { ...p, likedByMe: res.liked, likeCount: res.likeCount } : p)));
  }

  return (
    <div className="pb-nav">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-4">
          <Mark className="size-7" />
          <Wordmark />
        </div>
        <div className="grid grid-cols-2">
          {(["foryou", "following"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn("h-11 text-sm", mode === id ? "border-b-2 border-accent font-medium text-ink" : "text-muted")}
            >
              {id === "foryou" ? t("forYou") : t("following")}
            </button>
          ))}
        </div>
      </header>
      {query.loading ? <LoadingBlock label={t("loadingLooks")} /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {posts && posts.length === 0 ? (
        <div className="relative mx-4 mt-6 overflow-hidden rounded-[2rem]">
          <img src="/media/brand/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
          <div className="relative bg-gradient-to-t from-paper via-paper/85 to-paper/20 px-6 py-16 text-center">
            <p className="font-display text-3xl">{t("eraTitle")}</p>
            <p className="mt-2 text-sm text-muted">{t("eraBody")}</p>
            <Link to="/create" search={{ challenge: undefined }} className="btn-glow mt-5 inline-flex h-12 items-center rounded-full px-5 text-sm font-semibold">
              {t("createLook")}
            </Link>
          </div>
        </div>
      ) : null}
      {posts?.map((post) => <PostCard key={post.id} post={post} onLike={(p) => void onLike(p)} />)}
    </div>
  );
}
