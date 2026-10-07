import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, LoadingBlock, TextArea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ago, compact } from "@/lib/vti/format";
import { addComment, getPost, toggleLike } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/p/$postId")({ component: PostPage });

function PostPage() {
  const { postId } = Route.useParams();
  const query = useQuery(postId, () => getPost({ data: { id: postId } }));
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const data = query.data;

  async function onLike() {
    if (!data) return;
    const liked = !data.post.likedByMe;
    query.setData({
      ...data,
      post: { ...data.post, likedByMe: liked, likeCount: data.post.likeCount + (liked ? 1 : -1) },
    });
    const res = await toggleLike({ data: { postId } });
    if (!res.ok) {
      query.setData(data);
      return;
    }
    query.setData({
      ...data,
      post: { ...data.post, likedByMe: res.liked, likeCount: res.likeCount },
    });
  }

  async function onComment() {
    if (!data) return;
    setPending(true);
    setError(null);
    const res = await addComment({ data: { postId, body } });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBody("");
    query.setData({
      ...data,
      comments: [...data.comments, res.comment],
      post: { ...data.post, commentCount: res.commentCount },
    });
  }

  return (
    <div className="pb-nav">
      <TopBar title={data?.post.author.username ?? "Look"} fallback="/home" />
      {query.loading ? <LoadingBlock label="Loading look" /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {data === null && !query.loading && !query.error ? <ErrorNote message="That look is not here." /> : null}
      {data ? (
        <article>
          <img src={data.post.imageUrl} alt={data.post.caption || "Look"} className="aspect-[4/5] w-full bg-chip object-cover" />
          <div className="flex items-center gap-3 px-4 py-3">
            <Link to="/u/$username" params={{ username: data.post.author.username }} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar src={data.post.author.avatarUrl} name={data.post.author.username} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{data.post.author.username}</span>
                <span className="block text-xs text-muted">{ago(data.post.createdAt)}</span>
              </span>
            </Link>
            <button type="button" onClick={() => void onLike()} className="inline-flex h-11 items-center gap-1.5 text-sm" aria-pressed={data.post.likedByMe}>
              <Heart className={cn("size-5", data.post.likedByMe && "fill-accent text-accent")} />
              <span className="tabular-nums">{compact(data.post.likeCount)}</span>
            </button>
          </div>
          {data.post.challenge ? (
            <p className="px-4 pb-2 text-sm">
              <Link to="/challenges/$challengeId" params={{ challengeId: data.post.challenge.id }} className="text-accent">
                {data.post.challenge.title}
              </Link>
            </p>
          ) : null}
          {data.post.caption ? <p className="px-4 pb-4 text-sm">{data.post.caption}</p> : null}
          <section className="border-t border-line px-4 py-4">
            <h2 className="text-sm font-medium">{data.comments.length} comments</h2>
            <ul className="mt-3 space-y-4">
              {data.comments.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <Link to="/u/$username" params={{ username: comment.author.username }}>
                    <Avatar src={comment.author.avatarUrl} name={comment.author.username} size="sm" />
                  </Link>
                  <div>
                    <p className="text-sm">
                      <Link to="/u/$username" params={{ username: comment.author.username }} className="mr-1.5 font-medium">
                        {comment.author.username}
                      </Link>
                      {comment.body}
                    </p>
                    <p className="mt-1 text-xs text-muted">{ago(comment.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void onComment();
              }}
            >
              <TextArea value={body} onChange={(e) => setBody(e.target.value)} maxLength={400} rows={2} placeholder="Add a comment" />
              {error ? <p className="text-sm text-accent">{error}</p> : null}
              <Button type="submit" disabled={pending || !body.trim()}>{pending ? "Posting…" : "Comment"}</Button>
            </form>
          </section>
        </article>
      ) : null}
    </div>
  );
}
