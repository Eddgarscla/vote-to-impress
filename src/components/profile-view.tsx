import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button, ErrorNote, Field, LoadingBlock, TextArea, TextInput } from "@/components/ui";
import { UserButton } from "@/lib/auth/gates";
import { compact, placeLabel, placeMedal } from "@/lib/vti/format";
import { compressAvatar, isLikelyImage } from "@/lib/vti/image";
import { getProfile, toggleFollow, updateProfile } from "@/lib/vti/server";
import type { ProfilePayload } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";

export function ProfileView({ username }: { username?: string }) {
  const key = username ? `u:${username}` : "me";
  const query = useQuery(key, () => getProfile({ data: { username } }));
  const profile = query.data;

  async function onFollow() {
    if (!profile || profile.isSelf) return;
    const next = !profile.followedByMe;
    query.setData({
      ...profile,
      followedByMe: next,
      followers: profile.followers + (next ? 1 : -1),
    });
    const res = await toggleFollow({ data: { userId: profile.id } });
    if (!res.ok) {
      query.setData(profile);
      return;
    }
    query.setData({ ...profile, followedByMe: res.following, followers: res.followers });
  }

  if (query.loading) return <LoadingBlock label="Loading profile" />;
  if (query.error || !profile) {
    return <ErrorNote message={query.error ?? "That profile is not here."} onRetry={query.reload} />;
  }

  return (
    <div className="pb-nav">
      <header className="px-5 pt-6">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatarUrl} name={profile.username} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl leading-none">{profile.username}</h1>
            {profile.bio ? <p className="mt-2 text-sm text-ink">{profile.bio}</p> : <p className="mt-2 text-sm text-muted">No bio yet.</p>}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Looks" value={compact(profile.postCount)} />
          <Stat label="Followers" value={compact(profile.followers)} />
          <Stat label="Following" value={compact(profile.following)} />
        </dl>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat label="Impress" value={compact(profile.impressPoints)} />
          <Stat label="Wins" value={compact(profile.challengeWins)} />
          <Stat label="Top 3" value={compact(profile.topPlacements)} />
        </dl>
        <div className="mt-4">
          {profile.isSelf ? <Editor profile={profile} onSaved={(next) => query.setData(next)} /> : (
            <Button variant={profile.followedByMe ? "line" : "primary"} className="w-full" onClick={() => void onFollow()}>
              {profile.followedByMe ? "Following" : "Follow"}
            </Button>
          )}
        </div>
      </header>
      {profile.placements.length ? (
        <section className="mt-6 px-5">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Challenge results</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {profile.placements.map((p) => (
              <li key={p.challengeId}>
                <Link to="/challenges/$challengeId" params={{ challengeId: p.challengeId }} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    {placeMedal(p.place) ? <span className="mr-1">{placeMedal(p.place)}</span> : null}
                    {placeLabel(p.place)}
                    <span className="mt-0.5 block text-muted">{p.challengeTitle}</span>
                  </span>
                  <span className="tabular-nums text-muted">{p.points} pts</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {profile.isSelf ? (
        <p className="px-5 pt-4 text-sm">
          <Link to="/look-pop" className="underline underline-offset-4">Make your look pop</Link>
        </p>
      ) : null}
      {profile.isSelf ? (
        <div className="px-5 pt-4">
          <UserButton />
        </div>
      ) : null}
      <section className="mt-5">
        {profile.posts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            {profile.isSelf ? "Your looks will show up here." : "No looks yet."}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-0.5">
            {profile.posts.map((post) => (
              <li key={post.id}>
                <Link to="/p/$postId" params={{ postId: post.id }} className="block bg-chip">
                  <img src={post.imageUrl} alt="" className="aspect-[3/4] w-full object-cover" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-chip px-2 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-lg leading-tight tabular-nums">{value}</dd>
    </div>
  );
}

function Editor({ profile, onSaved }: { profile: ProfilePayload; onSaved: (next: ProfilePayload) => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <Button variant="line" className="w-full" onClick={() => setOpen(true)}>
        Edit profile
      </Button>
    );
  }

  async function save() {
    setPending(true);
    setError(null);
    const res = await updateProfile({
      data: { username, bio, avatarDataUrl: avatar },
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved({
      ...profile,
      username: res.username,
      bio: bio.trim(),
      avatarUrl: avatar ?? profile.avatarUrl,
    });
    setOpen(false);
  }

  return (
    <form
      className="space-y-3 rounded-3xl border border-line bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="Username" hint="Letters, numbers, underscore. 3–20.">
        <TextInput value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={20} required />
      </Field>
      <Field label="Bio">
        <TextArea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} />
      </Field>
      <Field label="Profile photo">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="block w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!isLikelyImage(file)) {
              setError("Use a JPG, PNG, or WebP.");
              return;
            }
            void compressAvatar(file).then(setAvatar).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Could not use that photo.");
            });
          }}
        />
      </Field>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
