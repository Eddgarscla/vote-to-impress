import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { LookGallery } from "@/components/gallery";
import { VerifiedMark } from "@/components/verified";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { compact } from "@/lib/vti/format";
import type { PostCard as Post } from "@/lib/vti/types";

export function PostCard({ post, onLike }: { post: Post; onLike: (post: Post) => void }) {
  const { t } = useI18n();
  const [pop, setPop] = useState(false);
  return (
    <article className="border-b border-line px-3 pb-4">
      <div className="flex items-center gap-3 px-1 py-3">
        <Link to="/u/$username" params={{ username: post.author.username }} className="flex min-w-0 items-center gap-3">
          <Avatar src={post.author.avatarUrl} name={post.author.username} />
          <span className="min-w-0">
            <span className="flex items-center gap-1 truncate text-sm font-medium">
              {post.author.username}
              {post.author.verified ? <VerifiedMark /> : null}
              {post.author.isTest ? <span className="text-xs text-muted">{t("test")}</span> : null}
            </span>
            {post.challenge ? <span className="block truncate text-xs tracking-wide text-accent uppercase">{post.challenge.title}</span> : null}
          </span>
        </Link>
      </div>
      <Link to="/p/$postId" params={{ postId: post.id }} className="look-frame block overflow-hidden rounded-3xl bg-chip">
        <LookGallery images={post.images?.length ? post.images : [post.imageUrl]} alt={post.caption || `Look by ${post.author.username}`} />
      </Link>
      <div className="flex items-center gap-1 px-2 pt-1">
        <button
          type="button"
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? t("unlike") : t("like")}
          onClick={() => {
            setPop(true);
            window.setTimeout(() => setPop(false), 420);
            onLike(post);
          }}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm"
        >
          <Heart className={cn("size-5", post.likedByMe && "fill-accent text-accent", pop && "heart-pop")} />
          <span>{t("like")}</span>
          <span className="tabular-nums">{compact(post.likeCount)}</span>
        </button>
        <Link
          to="/p/$postId"
          params={{ postId: post.id }}
          aria-label={t("commentsLabel")}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm"
        >
          <MessageCircle className="size-5" />
          <span className="tabular-nums">{compact(post.commentCount)}</span>
        </Link>
      </div>
      {post.caption ? (
        <p className="px-4 pb-3 text-sm leading-snug">
          <Link to="/u/$username" params={{ username: post.author.username }} className="mr-1.5 font-medium">
            {post.author.username}
          </Link>
          {post.caption}
        </p>
      ) : null}
    </article>
  );
}
