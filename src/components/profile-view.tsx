import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { AvatarCropper } from "@/components/avatar-cropper";
import { VerifiedMark } from "@/components/verified";
import { Button, ErrorNote, Field, LoadingBlock, TextArea, TextInput } from "@/components/ui";
import { UserButton } from "@/lib/auth/gates";
import { compact, placeLabel, placeMedal } from "@/lib/vti/format";
import { isLikelyImage } from "@/lib/vti/image";
import { getProfile, requestVerification, toggleFollow, updateProfile } from "@/lib/vti/server";
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

  const progress = profile.nextAt ? Math.min(100, Math.round((profile.impressPoints / profile.nextAt) * 100)) : 100;
  const span = profile.nextAt ?? profile.impressPoints;

  return (
    <div className="pb-nav">
      <header className="profile-head px-5 pt-6">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatarUrl} name={profile.username} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate font-display text-3xl leading-none">
              <span className="truncate">{profile.displayName || profile.username}</span>
              {profile.verified ? <VerifiedMark /> : null}
            </h1>
            <p className="mt-1 text-sm text-muted">@{profile.username}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              {profile.role === "founder" ? <span className="founder-badge">Founder</span> : null}
              <span className="text-xs tracking-widest text-gold uppercase">{profile.levelLabel}</span>
            </p>
            <div className="mt-2 max-w-xs">
              <div className="level-pip" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
              <p className="mt-1 text-xs text-muted">
                {profile.nextLabel ? `${profile.impressPoints} / ${span} toward ${profile.nextLabel}` : "Legend. The top of the ladder."}
              </p>
            </div>
            {profile.bio ? <p className="mt-2 text-sm text-ink">{profile.bio}</p> : <p className="mt-2 text-sm text-muted">No bio yet.</p>}
            {profile.isSelf || profile.showPersonal ? <ProfileFacts profile={profile} /> : null}
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
      {profile.isSelf && profile.role === "founder" ? (
          <p className="px-5 pt-4 text-sm">
            <Link to="/founder" className="font-medium text-gold underline underline-offset-4">Founder dashboard</Link>
          </p>
        ) : null}
        {profile.isSelf && !profile.verified ? <VerificationAsk /> : null}
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

function ProfileFacts({ profile }: { profile: ProfilePayload }) {
  const facts = [
    profile.pronouns,
    profile.location,
    profile.website,
    profile.instagram ? `IG @${profile.instagram}` : "",
    profile.tiktok ? `TikTok @${profile.tiktok}` : "",
    profile.xHandle ? `X @${profile.xHandle}` : "",
    profile.robloxUsername ? `Roblox ${profile.robloxUsername}` : "",
  ].filter(Boolean);
  if (!facts.length && !profile.robloxUrl) return null;
  return (
    <p className="mt-2 text-xs text-muted">
      {facts.join(" · ")}
      {profile.robloxUrl ? <> · <a className="underline" href={profile.robloxUrl}>Roblox profile</a></> : null}
    </p>
  );
}

function VerificationAsk() {
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<string | null>(null);
  return (
    <form
      className="mx-5 mt-4 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void requestVerification({ data: { message } }).then((res) => {
          setNote(res.ok ? "Request sent. The Founder will review it." : res.error);
        });
      }}
    >
      <Field label="Ask for verification">
        <TextArea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={400} rows={2} placeholder="Tell the Founder why this account should be verified." />
      </Field>
      <Button type="submit" variant="line">Send request</Button>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </form>
  );
}

function Editor({ profile, onSaved }: { profile: ProfilePayload; onSaved: (next: ProfilePayload) => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [pronouns, setPronouns] = useState(profile.pronouns);
  const [location, setLocation] = useState(profile.location);
  const [website, setWebsite] = useState(profile.website);
  const [instagram, setInstagram] = useState(profile.instagram);
  const [tiktok, setTiktok] = useState(profile.tiktok);
  const [xHandle, setXHandle] = useState(profile.xHandle);
  const [robloxUsername, setRobloxUsername] = useState(profile.robloxUsername);
  const [robloxUrl, setRobloxUrl] = useState(profile.robloxUrl);
  const [showPersonal, setShowPersonal] = useState(profile.showPersonal);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
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
      data: {
        username, displayName, bio, pronouns, location, website, instagram, tiktok, xHandle, robloxUsername, robloxUrl,
        showPersonal,
        avatarDataUrl: avatar,
      },
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved({
      ...profile,
      username: res.username,
      displayName: displayName.trim(),
      bio: bio.trim(),
      pronouns, location, website, instagram, tiktok, xHandle, robloxUsername, robloxUrl,
      showPersonal,
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
      <Field label="Display name"><TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} /></Field>
      <Field label="Username" hint="Letters, numbers, underscore. 3–20.">
        <TextInput value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={20} required />
      </Field>
      <Field label="Bio"><TextArea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} /></Field>
      <Field label="Pronouns"><TextInput value={pronouns} onChange={(e) => setPronouns(e.target.value)} maxLength={40} /></Field>
      <Field label="Location"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} maxLength={60} /></Field>
      <Field label="Website"><TextInput value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} /></Field>
      <Field label="Instagram"><TextInput value={instagram} onChange={(e) => setInstagram(e.target.value)} maxLength={40} /></Field>
      <Field label="TikTok"><TextInput value={tiktok} onChange={(e) => setTiktok(e.target.value)} maxLength={40} /></Field>
      <Field label="X"><TextInput value={xHandle} onChange={(e) => setXHandle(e.target.value)} maxLength={40} /></Field>
      <Field label="Roblox username" hint="Optional. This does not connect your Roblox account.">
        <TextInput value={robloxUsername} onChange={(e) => setRobloxUsername(e.target.value)} maxLength={40} />
      </Field>
      <Field label="Roblox profile link"><TextInput value={robloxUrl} onChange={(e) => setRobloxUrl(e.target.value)} maxLength={200} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showPersonal} onChange={(e) => setShowPersonal(e.target.checked)} />
        Show pronouns, location, and social links on my profile
      </label>
      <Field label="Profile photo">
        {cropSrc ? (
          <AvatarCropper
            src={cropSrc}
            onCancel={() => setCropSrc(null)}
            onSave={(dataUrl) => {
              setAvatar(dataUrl);
              setCropSrc(null);
            }}
          />
        ) : (
          <>
            {avatar ? <img src={avatar} alt="" className="mb-2 size-20 rounded-full object-cover" /> : null}
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
                setCropSrc(URL.createObjectURL(file));
              }}
            />
          </>
        )}
      </Field>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
