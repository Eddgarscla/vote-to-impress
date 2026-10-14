import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { AvatarCropper } from "@/components/avatar-cropper";
import { VerifiedMark } from "@/components/verified";
import { Button, ErrorNote, Field, LoadingBlock, TextArea, TextInput } from "@/components/ui";
import { useI18n, announce } from "@/lib/i18n";
import { compact, placeLabel, placeMedal } from "@/lib/vti/format";
import { isLikelyImage } from "@/lib/vti/image";
import { getProfile, requestVerification, toggleFollow, updateProfile } from "@/lib/vti/server";
import type { ProfilePayload } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";

export function ProfileView({ username }: { username?: string }) {
  const { t, lang } = useI18n();
  const key = username ? `u:${username}` : "me";
  const query = useQuery(key, () => getProfile({ data: { username } }));
  const profile = query.data;
  const [followedFlash, setFollowedFlash] = useState(false);
  const [levelNote, setLevelNote] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.isSelf) return;
    const previous = window.localStorage.getItem("vti.seenLevel");
    if (previous && previous !== profile.levelKey) setLevelNote(profile.levelLabel);
    window.localStorage.setItem("vti.seenLevel", profile.levelKey);
    const seenKey = "vti.seenWins";
    const seen = new Set((window.localStorage.getItem(seenKey) ?? "").split(",").filter(Boolean));
    const wins = profile.placements.filter((row) => row.place === 1);
    const fresh = wins.filter((row) => !seen.has(row.challengeId));
    if (seen.size > 0 && fresh[0]) announce(`${t("winNote")} ${fresh[0].challengeTitle}`);
    window.localStorage.setItem(seenKey, wins.map((row) => row.challengeId).join(","));
  }, [profile?.isSelf, profile?.levelKey, profile?.levelLabel, profile?.placements, t]);

  async function onFollow() {
    if (!profile || profile.isSelf) return;
    const next = !profile.followedByMe;
    if (next) setFollowedFlash(true);
    query.setData({
      ...profile,
      followedByMe: next,
      followers: profile.followers + (next ? 1 : -1),
    });
    const res = await toggleFollow({ data: { userId: profile.id } });
    if (!res.ok) {
      query.setData(profile);
      setFollowedFlash(false);
      return;
    }
    query.setData({ ...profile, followedByMe: res.following, followers: res.followers });
  }

  if (query.loading) return <LoadingBlock label={t("loadingProfile")} />;
  if (query.error || !profile) {
    return <ErrorNote message={query.error ?? t("missingProfile")} onRetry={query.reload} />;
  }

  return (
    <div className="pb-nav">
      <header className="profile-head px-5 pt-5">
        <div className="flex items-start gap-4">
          <Avatar src={profile.avatarUrl} name={profile.username} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="flex min-w-0 items-center gap-1.5 font-display text-2xl leading-none">
                <span className="truncate">{profile.displayName || profile.username}</span>
                {profile.verified ? <VerifiedMark /> : null}
              </h1>
              {profile.isSelf ? (
                <Link to="/settings" className="shrink-0 text-xs font-medium text-muted underline underline-offset-4">{t("settings")}</Link>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">@{profile.username}</p>
            <p className="mt-2 flex flex-wrap items-center gap-1.5">
              {profile.role === "founder" ? <span className="founder-badge">{t("founder")}</span> : null}
              <span className="level-badge">{profile.levelLabel}</span>
            </p>
            {profile.bio ? <p className="mt-2 text-sm text-ink">{profile.bio}</p> : <p className="mt-2 text-sm text-muted">{t("noBio")}</p>}
            {profile.isSelf || profile.showPersonal ? <ProfileFacts profile={profile} /> : null}
          </div>
        </div>
        <dl className="stat-row">
          <Stat label={t("followers")} value={compact(profile.followers)} />
          <Stat label={t("following")} value={compact(profile.following)} />
          <Stat label={t("impress")} value={compact(profile.impressPoints)} />
          <Stat label={t("wins")} value={compact(profile.challengeWins)} />
          <Stat label={t("top3")} value={compact(profile.topPlacements)} />
        </dl>
        {!profile.isSelf ? (
          <div className="mt-4">
            <Button variant={profile.followedByMe ? "line" : "primary"} className={followedFlash ? "follow-pop w-full" : "w-full"} onClick={() => void onFollow()}>
              {profile.followedByMe ? t("followingState") : t("follow")}
            </Button>
          </div>
        ) : null}
        {levelNote ? <p className="toast-pop mt-3 text-sm text-gold">{t("levelUp")}: {levelNote}</p> : null}
      </header>
      {profile.placements.length ? (
        <section className="mt-5 px-5">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">{t("results")}</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {profile.placements.map((p) => (
              <li key={p.challengeId}>
                <Link to="/challenges/$challengeId" params={{ challengeId: p.challengeId }} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    {placeMedal(p.place) ? <span className="mr-1">{placeMedal(p.place)}</span> : null}
                    {placeLabel(p.place, lang)}
                    <span className="mt-0.5 block text-muted">{p.challengeTitle}</span>
                  </span>
                  <span className="tabular-nums text-muted">{p.points} {t("pts")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {profile.isSelf && !profile.verified ? <VerificationAsk /> : null}
      <section className="mt-4">
        {profile.posts.length === 0 ? (
          <div className="mx-5 rounded-3xl border border-dashed border-line px-5 py-10 text-center">
            <p className="font-display text-2xl">{profile.isSelf ? t("emptyLooksSelf") : t("emptyLooksOther")}</p>
            {profile.isSelf ? (
              <Link to="/create" search={{ challenge: undefined }} className="btn-glow mt-4 inline-flex h-11 items-center rounded-full px-5 text-sm font-medium">
                {t("firstLook")}
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-1 px-1">
            {profile.posts.map((post) => (
              <li key={post.id}>
                <Link to="/p/$postId" params={{ postId: post.id }} className="look-frame block overflow-hidden rounded-xl bg-chip">
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
    <div>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function ProfileFacts({ profile }: { profile: ProfilePayload }) {
  const facts = [
    profile.pronouns,
    profile.showGender && profile.gender ? profile.gender : "",
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
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<string | null>(null);
  return (
    <form
      className="mx-5 mt-4 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void requestVerification({ data: { message } }).then((res) => {
          setNote(res.ok ? t("requestSent") : res.error);
        });
      }}
    >
      <Field label={t("askVerify")}>
        <TextArea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={400} rows={2} placeholder={t("verifyPlaceholder")} />
      </Field>
      <Button type="submit" variant="line">{t("sendRequest")}</Button>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </form>
  );
}

export function ProfileEditor({ profile, onSaved }: { profile: ProfilePayload; onSaved: (next: ProfilePayload) => void }) {
  const { t } = useI18n();
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
  const [gender, setGender] = useState(profile.gender);
  const [customGender, setCustomGender] = useState(
    profile.gender && !profile.genderChoices.includes(profile.gender) ? profile.gender : "",
  );
  const [showGender, setShowGender] = useState(profile.showGender);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    const chosenGender = gender === "Custom" ? customGender.trim() : gender;
    const res = await updateProfile({
      data: {
        username, displayName, bio, pronouns, location, website, instagram, tiktok, xHandle, robloxUsername, robloxUrl,
        showPersonal,
        gender: chosenGender,
        showGender,
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
      gender: chosenGender,
      showGender,
      avatarUrl: avatar ?? profile.avatarUrl,
    });
  }

  return (
    <form
      className="space-y-3 rounded-3xl border border-line bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label={t("displayName")}><TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} /></Field>
      <Field label={t("username")} hint={t("usernameRule")}>
        <TextInput value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={20} required />
      </Field>
      <Field label={t("bio")}><TextArea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} /></Field>
      <Field label={t("pronouns")}><TextInput value={pronouns} onChange={(e) => setPronouns(e.target.value)} maxLength={40} /></Field>
      <Field label={t("gender")} hint={t("genderHint")}>
        <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={profile.genderChoices.includes(gender) ? gender : gender ? "Custom" : ""} onChange={(e) => setGender(e.target.value)}>
          <option value="">{t("leaveBlank")}</option>
          {profile.genderChoices.map((choice) => (
            <option key={choice} value={choice}>{choice === "Custom" ? t("customWord") : choice}</option>
          ))}
        </select>
      </Field>
      {gender === "Custom" || (gender && !profile.genderChoices.includes(gender)) ? (
        <Field label={t("customWord")}>
          <TextInput value={customGender} onChange={(e) => setCustomGender(e.target.value)} maxLength={40} />
        </Field>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showGender} onChange={(e) => setShowGender(e.target.checked)} />
        {t("showGender")}
      </label>
      <Field label={t("location")}><TextInput value={location} onChange={(e) => setLocation(e.target.value)} maxLength={60} /></Field>
      <Field label={t("website")}><TextInput value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} /></Field>
      <Field label={t("instagram")}><TextInput value={instagram} onChange={(e) => setInstagram(e.target.value)} maxLength={40} /></Field>
      <Field label={t("tiktok")}><TextInput value={tiktok} onChange={(e) => setTiktok(e.target.value)} maxLength={40} /></Field>
      <Field label={t("x")}><TextInput value={xHandle} onChange={(e) => setXHandle(e.target.value)} maxLength={40} /></Field>
      <Field label={t("robloxUser")} hint={t("robloxHint")}>
        <TextInput value={robloxUsername} onChange={(e) => setRobloxUsername(e.target.value)} maxLength={40} />
      </Field>
      <Field label={t("robloxLink")}><TextInput value={robloxUrl} onChange={(e) => setRobloxUrl(e.target.value)} maxLength={200} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showPersonal} onChange={(e) => setShowPersonal(e.target.checked)} />
        {t("showPersonal")}
      </label>
      <Field label={t("profilePhoto")}>
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
                  setError(t("badPhoto"));
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
        <Button type="submit" className="w-full" disabled={pending}>{pending ? t("saving") : t("save")}</Button>
      </div>
    </form>
  );
}
