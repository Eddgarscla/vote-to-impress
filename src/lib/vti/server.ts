import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { finalizeCompetitions } from "@/lib/vti/competition";
import { FOUNDER_EMAIL, isFounderEmail } from "@/lib/vti/founder";
import { LEVELS } from "@/lib/vti/levels";
import { challengeHasStages, changeWallet, grantEntryBonus, loadStages, loadTwists, refreshWallet } from "@/lib/vti/runway";
import type {
  ChallengeBoard,
  ChallengeDetail,
  ChallengeSummary,
  CommentItem,
  ExplorePayload,
  PersonCard,
  Placement,
  PostCard,
  ProfilePayload,
  RankedLook,
  SeasonCard,
} from "@/lib/vti/types";

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "t" || v === "true" || v === "1";
  return false;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? String(v ?? "") : d.toISOString();
}

function toUsername(name: string, email: string): string {
  const raw = name.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 20);
  if (/^[a-z0-9_]{3,20}$/.test(raw)) return raw;
  const fromEmail = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 16) ?? "";
  if (/^[a-z0-9_]{3,16}$/.test(fromEmail)) return fromEmail;
  return "member";
}

function assertImage(dataUrl: string, max: number): string | null {
  if (dataUrl.length > max) return "That image is too large. Try a smaller one.";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) return "Use a JPG, PNG, or WebP image.";
  return null;
}

type PostRow = {
  id: string;
  image_url: string;
  caption: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean | string;
  challenge_id: string | null;
  challenge_title: string | null;
  author_id: string;
  username: string;
  avatar_url: string | null;
  verified?: boolean | string | null;
  is_test?: boolean | string | null;
};

function mapPost(r: PostRow, images?: string[]): PostCard {
  const gallery = images?.length ? images : [r.image_url];
  return {
    id: r.id,
    imageUrl: gallery[0] ?? r.image_url,
    images: gallery,
    caption: r.caption,
    createdAt: toIso(r.created_at),
    likeCount: asNum(r.like_count),
    commentCount: asNum(r.comment_count),
    likedByMe: asBool(r.liked_by_me),
    challenge: r.challenge_id ? { id: r.challenge_id, title: r.challenge_title ?? "" } : null,
    author: {
      id: r.author_id,
      username: r.username,
      avatarUrl: r.avatar_url,
      verified: asBool(r.verified),
      isTest: asBool(r.is_test),
    },
  };
}

async function galleryFor(sql: Sql, ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!ids.length) return map;
  const imgs = await sql.query<{ post_id: string; image_url: string }>(
    `select post_id, image_url from post_images where post_id in (${ids.map((_, i) => `$${i + 1}`).join(",")}) order by position asc`,
    ids,
  );
  for (const row of imgs) {
    const list = map.get(row.post_id) ?? [];
    list.push(row.image_url);
    map.set(row.post_id, list);
  }
  return map;
}

async function ladderFor(sql: Sql, points: number) {
  const rows = await sql<{ level_key: string; label: string; min_points: number }>`
    select level_key, label, min_points from level_thresholds order by min_points asc
  `;
  const steps = rows.length
    ? rows.map((row) => ({ key: row.level_key, label: row.label, min: asNum(row.min_points) }))
    : LEVELS.map((level) => ({ key: level.key, label: level.label, min: level.min }));
  let current = steps[0] ?? { key: "new_face", label: "New Face", min: 0 };
  for (const step of steps) {
    if (points >= step.min) current = step;
  }
  const index = steps.findIndex((step) => step.key === current.key);
  const next = steps[index + 1] ?? null;
  return { key: current.key, label: current.label, nextAt: next?.min ?? null, nextLabel: next?.label ?? null };
}

async function awardIfDue(sql: Sql) {
  await finalizeCompetitions(sql);
}

export async function syncFounderRole(sql: Sql, userId: string) {
  await sql`
    update profiles
    set role = 'member'
    where role = 'founder'
      and (
        is_demo = true
        or is_test = true
        or user_id not in (
          select "id" from "user" where lower("email") = ${FOUNDER_EMAIL}
        )
      )
  `;
  const auth = await sql<{ email: string }>`select "email" as email from "user" where "id" = ${userId}`;
  if (!isFounderEmail(auth[0]?.email)) return;
  await sql`
    update profiles
    set role = 'founder', verified = true
    where user_id = ${userId} and is_demo = false and is_test = false
  `;
}

export const ensureProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ avatarDataUrl: z.string().max(700_000).optional() }).parse(input ?? {}),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (data.avatarDataUrl) {
      const bad = assertImage(data.avatarDataUrl, 700_000);
      if (bad) return { ok: false as const, error: bad };
    }
    const sql = await getSql();
    const existing = await sql<{ username: string; avatar_url: string | null }>`
      select username, avatar_url from profiles where user_id = ${context.userId}
    `;
    if (existing.length) {
      if (data.avatarDataUrl && !existing[0].avatar_url) {
        await sql`update profiles set avatar_url = ${data.avatarDataUrl} where user_id = ${context.userId}`;
      }
      await syncFounderRole(sql, context.userId);
      return { ok: true as const, username: existing[0].username };
    }
    const auth = await sql<{ name: string; email: string }>`
      select "name" as name, "email" as email from "user" where "id" = ${context.userId}
    `;
    const base = toUsername(auth[0]?.name ?? "", auth[0]?.email ?? "");
    let username = base;
    for (let i = 0; i < 8; i++) {
      const taken = await sql`select 1 as one from profiles where username = ${username}`;
      if (!taken.length) break;
      username = `${base.slice(0, 14)}${1000 + Math.floor(Math.random() * 9000)}`.slice(0, 20);
    }
    await sql`
      insert into profiles (user_id, username, bio, avatar_url)
      values (${context.userId}, ${username}, '', ${data.avatarDataUrl ?? null})
    `;
    await syncFounderRole(sql, context.userId);
    return { ok: true as const, username };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      username: z.string().max(20),
      displayName: z.string().max(40).optional(),
      bio: z.string().max(160),
      pronouns: z.string().max(40).optional(),
      location: z.string().max(60).optional(),
      website: z.string().max(200).optional(),
      instagram: z.string().max(40).optional(),
      tiktok: z.string().max(40).optional(),
      xHandle: z.string().max(40).optional(),
      robloxUsername: z.string().max(40).optional(),
      robloxUrl: z.string().max(200).optional(),
      showPersonal: z.boolean().optional(),
      gender: z.string().max(40).optional(),
      showGender: z.boolean().optional(),
      avatarDataUrl: z.string().max(700_000).nullable().optional(),
    }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const username = data.username.trim().toLowerCase();
    const bio = data.bio.trim();
    const clean = (value: string | undefined, max: number) => (value ?? "").trim().slice(0, max);
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return { ok: false as const, error: "Usernames are 3–20 characters: letters, numbers, underscore." };
    }
    if (data.avatarDataUrl) {
      const bad = assertImage(data.avatarDataUrl, 700_000);
      if (bad) return { ok: false as const, error: bad };
    }
    const sql = await getSql();
    const clash = await sql<{ user_id: string }>`
      select user_id from profiles where username = ${username} and user_id <> ${context.userId}
    `;
    if (clash.length) return { ok: false as const, error: "That username is taken." };
    const gender = clean(data.gender, 40);
    if (gender) {
      const options = await sql<{ id: string; label: string }>`
        select id, label from gender_options where active = true
      `;
      const labels = options.map((option) => option.label);
      const customOn = options.some((option) => option.id === "g_custom" || option.label.toLowerCase() === "custom");
      if (!labels.includes(gender) && !customOn) {
        return { ok: false as const, error: "Choose a gender option from the list, or leave it blank." };
      }
    }
    await sql`
      update profiles set
        username = ${username},
        bio = ${bio},
        display_name = ${clean(data.displayName, 40)},
        pronouns = ${clean(data.pronouns, 40)},
        location = ${clean(data.location, 60)},
        website = ${clean(data.website, 200)},
        instagram = ${clean(data.instagram, 40).replace(/^@/, "")},
        tiktok = ${clean(data.tiktok, 40).replace(/^@/, "")},
        x_handle = ${clean(data.xHandle, 40).replace(/^@/, "")},
        roblox_username = ${clean(data.robloxUsername, 40)},
        roblox_url = ${clean(data.robloxUrl, 200)},
        show_personal = ${data.showPersonal !== false},
        gender = ${gender},
        show_gender = ${data.showGender === true},
        avatar_url = coalesce(${data.avatarDataUrl ?? null}, avatar_url)
      where user_id = ${context.userId}
    `;
    return { ok: true as const, username };
  });

async function loadProfile(sql: Sql, me: string, username?: string): Promise<ProfilePayload | null> {
  const rows = username
    ? await sql<Record<string, unknown>>`
        select p.user_id, p.username, p.display_name, p.bio, p.avatar_url, p.impress_points, p.challenge_wins, p.top_placements,
          p.role, p.level_key, p.verified, p.is_test, p.pronouns, p.location, p.website, p.instagram, p.tiktok, p.x_handle,
          p.roblox_username, p.roblox_url, p.show_personal, p.gender, p.show_gender,
          (p.follower_base + (select count(*)::int from follows f where f.following_id = p.user_id)) as followers,
          (p.following_base + (select count(*)::int from follows f where f.follower_id = p.user_id)) as following_count,
          (select count(*)::int from posts po where po.user_id = p.user_id) as post_count,
          exists(select 1 from follows f where f.follower_id = ${me} and f.following_id = p.user_id) as followed_by_me
        from profiles p
        where p.username = ${username}
      `
    : await sql<Record<string, unknown>>`
        select p.user_id, p.username, p.display_name, p.bio, p.avatar_url, p.impress_points, p.challenge_wins, p.top_placements,
          p.role, p.level_key, p.verified, p.is_test, p.pronouns, p.location, p.website, p.instagram, p.tiktok, p.x_handle,
          p.roblox_username, p.roblox_url, p.show_personal, p.gender, p.show_gender,
          (p.follower_base + (select count(*)::int from follows f where f.following_id = p.user_id)) as followers,
          (p.following_base + (select count(*)::int from follows f where f.follower_id = p.user_id)) as following_count,
          (select count(*)::int from posts po where po.user_id = p.user_id) as post_count,
          false as followed_by_me
        from profiles p
        where p.user_id = ${me}
      `;
  const row = rows[0];
  if (!row) return null;
  const id = String(row.user_id);
  const isSelf = id === me;
  const posts = await sql<{ id: string; image_url: string }>`
    select id, image_url from posts where user_id = ${id} order by created_at desc
  `;
  const placements = await sql<{ challenge_id: string; title: string; place: number; points: number }>`
    select c.id as challenge_id, c.title, r.place, r.points
    from challenge_results r
    join challenges c on c.id = r.challenge_id
    where r.user_id = ${id}
      and c.is_demo = false
      and c.results_published = true
    order by c.end_date desc
    limit 6
  `;
  const mapped: Placement[] = placements.map((p) => ({
    challengeId: p.challenge_id,
    challengeTitle: p.title,
    place: asNum(p.place),
    points: asNum(p.points),
  }));
  const level = await ladderFor(sql, asNum(row.impress_points));
  const choices = await sql<{ label: string }>`
    select label from gender_options where active = true order by sort_order asc, label asc
  `;
  const auth = await sql<{ email: string }>`select "email" as email from "user" where "id" = ${id}`;
  const authEmail = auth[0]?.email ?? null;
  const founder = String(row.role) === "founder" && !asBool(row.is_test) && isFounderEmail(authEmail);
  const showPersonal = asBool(row.show_personal);
  const share = isSelf || showPersonal;
  return {
    id,
    username: String(row.username),
    bio: String(row.bio ?? ""),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    email: isSelf ? authEmail : null,
    isSelf,
    followedByMe: asBool(row.followed_by_me),
    followers: asNum(row.followers),
    following: asNum(row.following_count),
    postCount: asNum(row.post_count),
    impressPoints: asNum(row.impress_points),
    challengeWins: asNum(row.challenge_wins),
    topPlacements: asNum(row.top_placements),
    role: founder ? "founder" : "member",
    verified: founder || asBool(row.verified),
    isTest: asBool(row.is_test),
    levelKey: level.key,
    levelLabel: level.label,
    nextAt: level.nextAt,
    nextLabel: level.nextLabel,
    displayName: String(row.display_name ?? ""),
    pronouns: share ? String(row.pronouns ?? "") : "",
    location: share ? String(row.location ?? "") : "",
    website: share ? String(row.website ?? "") : "",
    instagram: share ? String(row.instagram ?? "") : "",
    tiktok: share ? String(row.tiktok ?? "") : "",
    xHandle: share ? String(row.x_handle ?? "") : "",
    robloxUsername: share ? String(row.roblox_username ?? "") : "",
    robloxUrl: share ? String(row.roblox_url ?? "") : "",
    showPersonal,
    gender: isSelf || asBool(row.show_gender) ? String(row.gender ?? "") : "",
    showGender: asBool(row.show_gender),
    genderChoices: choices.map((choice) => choice.label),
    posts: posts.map((p) => ({ id: p.id, imageUrl: p.image_url })),
    placements: mapped,
  };
}

export const getProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ username: z.string().max(20).optional() }).parse(input ?? {}))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await syncFounderRole(sql, context.userId);
    return loadProfile(sql, context.userId, data.username);
  });

export const getFeed = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ mode: z.enum(["foryou", "following"]) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    const rows = data.mode === "following"
      ? await sql<PostRow>`
          select
            p.id, p.image_url, p.caption, p.created_at::text as created_at,
            (select count(*)::int from likes l where l.post_id = p.id) as like_count,
            (select count(*)::int from comments cm where cm.post_id = p.id) as comment_count,
            exists(select 1 from likes l where l.post_id = p.id and l.user_id = ${me}) as liked_by_me,
            c.id as challenge_id, c.title as challenge_title,
            pr.user_id as author_id, pr.username, pr.avatar_url, pr.verified, pr.is_test
          from posts p
          join profiles pr on pr.user_id = p.user_id
          left join challenges c on c.id = p.challenge_id
          where (p.user_id = ${me}
             or p.user_id in (select following_id from follows where follower_id = ${me}))
            and p.is_demo = false
          order by p.created_at desc
          limit 40
        `
      : await sql<PostRow>`
          select
            p.id, p.image_url, p.caption, p.created_at::text as created_at,
            (select count(*)::int from likes l where l.post_id = p.id) as like_count,
            (select count(*)::int from comments cm where cm.post_id = p.id) as comment_count,
            exists(select 1 from likes l where l.post_id = p.id and l.user_id = ${me}) as liked_by_me,
            c.id as challenge_id, c.title as challenge_title,
            pr.user_id as author_id, pr.username, pr.avatar_url, pr.verified, pr.is_test
          from posts p
          join profiles pr on pr.user_id = p.user_id
          left join challenges c on c.id = p.challenge_id
          where p.is_demo = false
          order by (
            (select count(*) from likes l where l.post_id = p.id) * 2
            + (select count(*) from comments cm where cm.post_id = p.id)
          ) desc, p.created_at desc
          limit 40
        `;
    const images = await galleryFor(sql, rows.map((row) => row.id));
    return rows.map((row) => mapPost(row, images.get(row.id)));
  });

export const getPost = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    const rows = await sql<PostRow>`
      select
        p.id, p.image_url, p.caption, p.created_at::text as created_at,
        (select count(*)::int from likes l where l.post_id = p.id) as like_count,
        (select count(*)::int from comments cm where cm.post_id = p.id) as comment_count,
        exists(select 1 from likes l where l.post_id = p.id and l.user_id = ${me}) as liked_by_me,
        c.id as challenge_id, c.title as challenge_title,
        pr.user_id as author_id, pr.username, pr.avatar_url, pr.verified, pr.is_test
      from posts p
      join profiles pr on pr.user_id = p.user_id
      left join challenges c on c.id = p.challenge_id
      where p.id = ${data.id}
    `;
    if (!rows[0]) return null;
    const comments = await sql<{
      id: string; body: string; created_at: string; author_id: string; username: string; avatar_url: string | null;
    }>`
      select cm.id, cm.body, cm.created_at::text as created_at,
        pr.user_id as author_id, pr.username, pr.avatar_url, pr.verified, pr.is_test
      from comments cm
      join profiles pr on pr.user_id = cm.user_id
      where cm.post_id = ${data.id}
      order by cm.created_at asc
    `;
    const thread: CommentItem[] = comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: toIso(c.created_at),
      author: { id: c.author_id, username: c.username, avatarUrl: c.avatar_url },
    }));
    const images = await galleryFor(sql, [rows[0].id]);
    return { post: mapPost(rows[0], images.get(rows[0].id)), comments: thread, mine: rows[0].author_id === me };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ postId: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    const post = await sql`select id from posts where id = ${data.postId}`;
    if (!post.length) return { ok: false as const, error: "That look is gone." };
    const existing = await sql`select 1 as one from likes where user_id = ${me} and post_id = ${data.postId}`;
    if (existing.length) {
      await sql`delete from likes where user_id = ${me} and post_id = ${data.postId}`;
    } else {
      await sql`insert into likes (user_id, post_id) values (${me}, ${data.postId})`;
    }
    const count = await sql<{ n: number }>`select count(*)::int as n from likes where post_id = ${data.postId}`;
    return { ok: true as const, liked: !existing.length, likeCount: asNum(count[0]?.n) };
  });

export const addComment = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ postId: z.string().min(1).max(80), body: z.string().max(400) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const body = data.body.trim();
    if (!body) return { ok: false as const, error: "Write a comment first." };
    const sql = await getSql();
    const me = context.userId;
    const post = await sql`select id from posts where id = ${data.postId}`;
    if (!post.length) return { ok: false as const, error: "That look is gone." };
    const profile = await sql<{ username: string; avatar_url: string | null }>`
      select username, avatar_url from profiles where user_id = ${me}
    `;
    if (!profile.length) return { ok: false as const, error: "Finish your profile first." };
    const id = `c_${crypto.randomUUID()}`;
    const inserted = await sql<{ created_at: string }>`
      insert into comments (id, post_id, user_id, body) values (${id}, ${data.postId}, ${me}, ${body})
      returning created_at::text as created_at
    `;
    const comment: CommentItem = {
      id,
      body,
      createdAt: toIso(inserted[0]?.created_at),
      author: { id: me, username: profile[0].username, avatarUrl: profile[0].avatar_url },
    };
    const count = await sql<{ n: number }>`select count(*)::int as n from comments where post_id = ${data.postId}`;
    return { ok: true as const, comment, commentCount: asNum(count[0]?.n) };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ userId: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    if (data.userId === me) return { ok: false as const, error: "You cannot follow yourself." };
    const target = await sql`select user_id from profiles where user_id = ${data.userId}`;
    if (!target.length) return { ok: false as const, error: "That profile is not here." };
    const existing = await sql`
      select 1 as one from follows where follower_id = ${me} and following_id = ${data.userId}
    `;
    if (existing.length) {
      await sql`delete from follows where follower_id = ${me} and following_id = ${data.userId}`;
    } else {
      await sql`insert into follows (follower_id, following_id) values (${me}, ${data.userId})`;
    }
    const count = await sql<{ n: number; base: number }>`
      select p.follower_base as base, (select count(*)::int from follows f where f.following_id = p.user_id) as n
      from profiles p where p.user_id = ${data.userId}
    `;
    return {
      ok: true as const,
      following: !existing.length,
      followers: asNum(count[0]?.base) + asNum(count[0]?.n),
    };
  });

function mapChallenge(row: Record<string, unknown>): ChallengeSummary {
  const phase = String(row.phase ?? "open") as ChallengeSummary["phase"];
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    imageUrl: String(row.image_url),
    theme: String(row.theme ?? ""),
    startDate: toIso(row.start_date),
    endDate: toIso(row.end_date),
    submissionsClose: toIso(row.submissions_close ?? row.end_date),
    votingClose: toIso(row.voting_close ?? row.end_date),
    phase,
    participants: asNum(row.participants),
    pointsFirst: asNum(row.points_first),
    pointsSecond: asNum(row.points_second),
    pointsThird: asNum(row.points_third),
    voteBudget: asNum(row.vote_budget) || 10,
    isDemo: asBool(row.is_demo),
    seasonId: String(row.season_id ?? ""),
    kind: (String(row.kind) === "daily" || String(row.kind) === "monthly" ? String(row.kind) : "weekly") as ChallengeSummary["kind"],
    active: row.active == null ? true : asBool(row.active),
  };
}

async function loadSeason(sql: Sql): Promise<SeasonCard | null> {
  const rows = await sql<Record<string, unknown>>`
    select id, title, tagline, theme_key, starts_at::text as starts_at, ends_at::text as ends_at, results_published
    from seasons
    order by (starts_at <= now() and ends_at > now()) desc, starts_at desc
    limit 1
  `;
  const season = rows[0];
  if (!season) return null;
  const published = asBool(season.results_published);
  const podium = published
    ? await sql<Record<string, unknown>>`
        select r.place, r.points, r.weekly_wins, pr.username, pr.avatar_url
        from season_results r
        join profiles pr on pr.user_id = r.user_id
        where r.season_id = ${String(season.id)} and r.place <= 3
        order by r.place asc
      `
    : [];
  return {
    id: String(season.id),
    title: String(season.title),
    tagline: String(season.tagline ?? ""),
    themeKey: String(season.theme_key ?? "gloss"),
    startsAt: toIso(season.starts_at),
    endsAt: toIso(season.ends_at),
    published,
    podium: podium.map((row) => ({
      place: asNum(row.place),
      username: String(row.username),
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
      points: asNum(row.points),
      weeklyWins: asNum(row.weekly_wins),
    })),
  };
}

export const getFloor = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await awardIfDue(sql);
    const season = await loadSeason(sql);
    const settings = await sql<{ theme_key: string; accent_color: string; theme_name: string }>`
      select theme_key, accent_color, theme_name from platform_settings where id = 'current'
    `;
    const themeKey = settings[0]?.theme_key || (season && !season.published && season.themeKey ? season.themeKey : "gloss");
    const themes = await sql<{ weekly_theme: string; monthly_theme: string }>`
      select weekly_theme, monthly_theme from platform_settings where id = 'current'
    `;
    await syncFounderRole(sql, context.userId);
    const roleRow = await sql<{ role: string; email: string }>`
      select p.role, u."email" as email
      from profiles p
      left join "user" u on u."id" = p.user_id
      where p.user_id = ${context.userId}
    `;
    const founder = roleRow[0]?.role === "founder" && isFounderEmail(roleRow[0]?.email);
    return {
      themeKey,
      weeklyTheme: themes[0]?.weekly_theme ?? "",
      monthlyTheme: themes[0]?.monthly_theme ?? "",
      seasonTitle: season?.title ?? "",
      role: founder ? ("founder" as const) : ("member" as const),
      accentColor: settings[0]?.accent_color ?? "",
      themeName: settings[0]?.theme_name ?? "",
    };
  });

export const listChallenges = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ChallengeBoard> => {
    const sql = await getSql();
    await awardIfDue(sql);
    const rows = await sql<Record<string, unknown>>`
      select c.id, c.title, c.description, c.image_url, c.theme,
        c.start_date::text as start_date, c.end_date::text as end_date,
        c.submissions_close::text as submissions_close, c.voting_close::text as voting_close,
        c.points_first, c.points_second, c.points_third, c.vote_budget, c.is_demo, c.season_id, c.kind, c.active,
        (select count(*)::int from challenge_submissions s where s.challenge_id = c.id) as participants
      from challenges c
      where c.is_demo = false and coalesce(c.cancelled, false) = false
      order by (coalesce(c.voting_close, c.end_date) <= now()) asc, c.end_date asc
    `;
    const phased = await sql<Record<string, unknown>>`
      select c.id,
        case
          when c.is_demo or coalesce(c.cancelled, false) then 'ended'
          when coalesce(c.active, true) = false then 'paused'
          when now() < c.start_date then 'upcoming'
          when now() >= coalesce(c.voting_close, c.end_date) then 'ended'
          when now() >= coalesce(c.submissions_close, c.end_date) then 'voting'
          else 'open'
        end as phase
      from challenges c
      where c.is_demo = false and coalesce(c.cancelled, false) = false
    `;
    const phaseById = new Map(phased.map((row) => [String(row.id), String(row.phase)]));
    const roleRow = await sql<{ role: string; email: string }>`
      select p.role, u."email" as email
      from profiles p
      left join "user" u on u."id" = p.user_id
      where p.user_id = ${context.userId}
    `;
    return {
      season: await loadSeason(sql),
      challenges: rows.map((row) => mapChallenge({ ...row, phase: phaseById.get(String(row.id)) ?? "open" })),
      role: roleRow[0]?.role === "founder" && isFounderEmail(roleRow[0]?.email) ? "founder" : "member",
    };
  });

export const getChallenge = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<ChallengeDetail | null> => {
    const sql = await getSql();
    await awardIfDue(sql);
    const me = context.userId;
    const rows = await sql<Record<string, unknown>>`
      select c.id, c.title, c.description, c.image_url, c.theme,
        c.start_date::text as start_date, c.end_date::text as end_date,
        c.submissions_close::text as submissions_close, c.voting_close::text as voting_close,
        c.points_first, c.points_second, c.points_third, c.vote_budget, c.is_demo, c.season_id, c.kind, c.active,
        c.results_published,
        case
          when c.is_demo or coalesce(c.cancelled, false) then 'ended'
          when coalesce(c.active, true) = false then 'paused'
          when now() < c.start_date then 'upcoming'
          when now() >= coalesce(c.voting_close, c.end_date) then 'ended'
          when now() >= coalesce(c.submissions_close, c.end_date) then 'voting'
          else 'open'
        end as phase,
        (select count(*)::int from challenge_submissions s where s.challenge_id = c.id and exists (
          select 1 from profiles pr where pr.user_id = s.user_id and pr.is_demo = false
        )) as participants
      from challenges c
      where c.id = ${data.id}
    `;
    if (!rows[0]) return null;
    const summary = mapChallenge(rows[0]);
    const resultsPublic = summary.phase === "ended" && !summary.isDemo && asBool(rows[0].results_published);
    const subs = await sql<Record<string, unknown>>`
      select s.id, s.post_id, s.user_id, s.stage_id, s.created_at::text as created_at,
        pr.username, pr.avatar_url, p.image_url, p.caption,
        coalesce(sum(v.weight), 0)::int as votes,
        exists(select 1 from votes mv where mv.submission_id = s.id and mv.voter_id = ${me}) as voted_by_me
      from challenge_submissions s
      join profiles pr on pr.user_id = s.user_id
      join posts p on p.id = s.post_id
      left join votes v on v.submission_id = s.id
      where s.challenge_id = ${data.id}
        and pr.is_demo = false
      group by s.id, s.post_id, s.user_id, s.stage_id, s.created_at, pr.username, pr.avatar_url, p.image_url, p.caption
      order by s.created_at asc
    `;
    const awarded = resultsPublic
      ? await sql<{ user_id: string; points: number; place: number }>`
          select user_id, points, place from challenge_results where challenge_id = ${data.id}
        `
      : [];
    const awardMap = new Map(awarded.map((a) => [a.user_id, a]));
    const ranking: RankedLook[] = subs.map((s) => {
      const stored = awardMap.get(String(s.user_id));
      const place = resultsPublic ? asNum(stored?.place) : null;
      const points = resultsPublic ? asNum(stored?.points) : null;
      return {
        submissionId: String(s.id),
        postId: String(s.post_id),
        userId: String(s.user_id),
        username: String(s.username),
        avatarUrl: s.avatar_url ? String(s.avatar_url) : null,
        imageUrl: String(s.image_url),
        caption: String(s.caption ?? ""),
        votes: resultsPublic ? asNum(s.votes) : null,
        votedByMe: asBool(s.voted_by_me),
        place,
        points,
        pointsLabel: resultsPublic && place && place <= 3 ? `${points} pts` : "",
        stageId: String(s.stage_id ?? ""),
      };
    });
    if (resultsPublic) ranking.sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
    const stages = await loadStages(sql, data.id);
    const twists = await loadTwists(sql, data.id, true);
    const wallet = await refreshWallet(sql, me);
    const openStageId = stages.find((stage) => stage.open)?.id ?? "";
    const mine = ranking.find((row) => row.userId === me && (stages.length === 0 || row.stageId === openStageId)) ?? null;
    const eligible = mine || summary.phase !== "open" || (stages.length > 0 && !openStageId)
      ? []
      : await sql<{ id: string; image_url: string; caption: string }>`
          select id, image_url, caption from posts
          where user_id = ${me} and challenge_id is null and is_demo = false
          order by created_at desc
          limit 12
        `;
    return {
      ...summary,
      ranking,
      mySubmissionId: mine?.submissionId ?? null,
      eligiblePosts: eligible.map((p) => ({ id: p.id, imageUrl: p.image_url, caption: p.caption })),
      canSubmit: summary.phase === "open" && !summary.isDemo && (stages.length === 0 || Boolean(openStageId)),
      canVote: (summary.phase === "open" || summary.phase === "voting") && !summary.isDemo,
      resultsPublic,
      votesUsed: Math.max(0, wallet.max - wallet.balance),
      votesLeft: wallet.balance,
      wallet: { balance: wallet.balance, max: wallet.max, regen: wallet.regen, nextInMs: wallet.nextInMs },
      stages,
      twists,
      openStageId,
    };
  });

async function challengeOpen(sql: Sql, challengeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await sql<{ phase: string; is_demo: boolean | string }>`
    select c.is_demo,
      case
        when c.is_demo or coalesce(c.cancelled, false) then 'ended'
        when coalesce(c.active, true) = false then 'paused'
        when now() < c.start_date then 'upcoming'
        when now() >= coalesce(c.voting_close, c.end_date) then 'ended'
        when now() >= coalesce(c.submissions_close, c.end_date) then 'voting'
        else 'open'
      end as phase
    from challenges c where c.id = ${challengeId}
  `;
  if (!rows.length) return { ok: false, error: "That challenge is not here." };
  if (asBool(rows[0].is_demo)) return { ok: false, error: "Studio looks are not a live challenge." };
  if (rows[0].phase !== "open") return { ok: false, error: "Submissions are closed for this challenge." };
  return { ok: true };
}

export const createPost = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      imageDataUrl: z.string().min(32).max(1_200_000).optional(),
      imageDataUrls: z.array(z.string().min(32).max(1_200_000)).min(1).max(24).optional(),
      caption: z.string().max(300),
      challengeId: z.string().max(80).nullable().optional(),
      stageId: z.string().max(80).optional(),
    }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const images = (data.imageDataUrls?.length ? data.imageDataUrls : data.imageDataUrl ? [data.imageDataUrl] : []).slice(0, 24);
    if (!images.length) return { ok: false as const, error: "Add at least one photo." };
    for (const image of images) {
      const bad = assertImage(image, 1_200_000);
      if (bad) return { ok: false as const, error: bad };
    }
    const caption = data.caption.trim();
    const challengeId = data.challengeId || null;
    const sql = await getSql();
    const me = context.userId;
    const profile = await sql`select user_id from profiles where user_id = ${me}`;
    if (!profile.length) return { ok: false as const, error: "Finish your profile first." };
    if (challengeId) {
      const open = await challengeOpen(sql, challengeId);
      if (!open.ok) return open;
      const staged = await challengeHasStages(sql, challengeId);
      let stageId = "";
      if (staged) {
        const stages = await loadStages(sql, challengeId);
        const current = stages.find((stage) => stage.open);
        if (!current) return { ok: false as const, error: "The current stage is not open yet." };
        if (data.stageId && data.stageId !== current.id) return { ok: false as const, error: "That stage is not open." };
        stageId = current.id;
      }
      const already = await sql`
        select id from challenge_submissions
        where challenge_id = ${challengeId} and user_id = ${me} and stage_id = ${stageId}
      `;
      if (already.length) return { ok: false as const, error: staged ? "You already entered this stage." : "You already entered this challenge." };
      const postId = `p_${crypto.randomUUID()}`;
      await sql`
        insert into posts (id, user_id, image_url, caption, challenge_id)
        values (${postId}, ${me}, ${images[0]}, ${caption}, ${challengeId})
      `;
      for (let i = 0; i < images.length; i += 1) {
        await sql`
          insert into post_images (post_id, position, image_url)
          values (${postId}, ${i}, ${images[i]})
        `;
      }
      await sql`
        insert into challenge_submissions (id, challenge_id, post_id, user_id, stage_id)
        values (${`s_${crypto.randomUUID()}`}, ${challengeId}, ${postId}, ${me}, ${stageId})
      `;
      await grantEntryBonus(sql, me);
      return { ok: true as const, id: postId, challengeId };
    }
    const postId = `p_${crypto.randomUUID()}`;
    await sql`
      insert into posts (id, user_id, image_url, caption, challenge_id)
      values (${postId}, ${me}, ${images[0]}, ${caption}, ${null})
    `;
    for (let i = 0; i < images.length; i += 1) {
      await sql`
        insert into post_images (post_id, position, image_url)
        values (${postId}, ${i}, ${images[i]})
      `;
    }
    return { ok: true as const, id: postId, challengeId: null };
  });

export const submitExistingPost = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ postId: z.string().min(1).max(80), challengeId: z.string().min(1).max(80) }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    const open = await challengeOpen(sql, data.challengeId);
    if (!open.ok) return open;
    const staged = await challengeHasStages(sql, data.challengeId);
    let stageId = "";
    if (staged) {
      const stages = await loadStages(sql, data.challengeId);
      const current = stages.find((stage) => stage.open);
      if (!current) return { ok: false as const, error: "The current stage is not open yet." };
      stageId = current.id;
    }
    const already = await sql`
      select id from challenge_submissions
      where challenge_id = ${data.challengeId} and user_id = ${me} and stage_id = ${stageId}
    `;
    if (already.length) return { ok: false as const, error: staged ? "You already entered this stage." : "You already entered this challenge." };
    const post = await sql<{ challenge_id: string | null }>`
      select challenge_id from posts where id = ${data.postId} and user_id = ${me}
    `;
    if (!post.length) return { ok: false as const, error: "That look is not yours." };
    if (post[0].challenge_id) return { ok: false as const, error: "That look is already in a challenge." };
    await sql`update posts set challenge_id = ${data.challengeId} where id = ${data.postId} and user_id = ${me}`;
    await sql`
      insert into challenge_submissions (id, challenge_id, post_id, user_id, stage_id)
      values (${`s_${crypto.randomUUID()}`}, ${data.challengeId}, ${data.postId}, ${me}, ${stageId})
    `;
    await grantEntryBonus(sql, me);
    return { ok: true as const };
  });

export const toggleVote = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ submissionId: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    const sub = await sql<{
      user_id: string;
      challenge_id: string;
      phase: string;
      is_demo: boolean | string;
      vote_budget: number;
    }>`
      select s.user_id, s.challenge_id, c.is_demo, c.vote_budget,
        case
          when c.is_demo or coalesce(c.cancelled, false) then 'ended'
          when coalesce(c.active, true) = false then 'paused'
          when now() < c.start_date then 'upcoming'
          when now() >= coalesce(c.voting_close, c.end_date) then 'ended'
          when now() >= coalesce(c.submissions_close, c.end_date) then 'voting'
          else 'open'
        end as phase
      from challenge_submissions s
      join challenges c on c.id = s.challenge_id
      where s.id = ${data.submissionId}
    `;
    if (!sub.length) return { ok: false as const, error: "That entry is not here." };
    if (asBool(sub[0].is_demo) || (sub[0].phase !== "open" && sub[0].phase !== "voting")) {
      return { ok: false as const, error: "Voting is closed." };
    }
    if (sub[0].user_id === me) return { ok: false as const, error: "You cannot vote for your own look." };
    const existing = await sql<{ weight: number }>`
      select weight from votes where voter_id = ${me} and submission_id = ${data.submissionId}
    `;
    const pack = (voted: boolean, wallet: { balance: number; max: number; regen: number; nextInMs: number | null }) => ({
      ok: true as const,
      voted,
      votesUsed: Math.max(0, wallet.max - wallet.balance),
      votesLeft: wallet.balance,
      wallet,
    });
    if (existing.length) {
      const rules = await refreshWallet(sql, me);
      if (!rules.allowMulti) {
        await sql`delete from votes where voter_id = ${me} and submission_id = ${data.submissionId}`;
        const wallet = await changeWallet(sql, me, Math.max(1, asNum(existing[0].weight)));
        return pack(false, wallet);
      }
      if (rules.balance < 1) return { ok: false as const, error: "You are out of votes. They come back on their own." };
      await sql`
        update votes set weight = weight + 1
        where voter_id = ${me} and submission_id = ${data.submissionId}
      `;
      const wallet = await changeWallet(sql, me, -1);
      return pack(true, wallet);
    }
    const ready = await refreshWallet(sql, me);
    if (ready.balance < 1) return { ok: false as const, error: "You are out of votes. They come back on their own." };
    await sql`insert into votes (voter_id, submission_id, weight) values (${me}, ${data.submissionId}, 1)`;
    const wallet = await changeWallet(sql, me, -1);
    return pack(true, wallet);
  });

async function requireFounder(sql: Sql, userId: string) {
  const rows = await sql<{ role: string; email: string }>`
    select p.role, u."email" as email
    from profiles p
    join "user" u on u."id" = p.user_id
    where p.user_id = ${userId}
  `;
  if (rows[0]?.role !== "founder" || !isFounderEmail(rows[0]?.email)) {
    return { ok: false as const, error: "Only the Founder can manage the platform." };
  }
  return { ok: true as const };
}

export const createWeeklyChallenge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      title: z.string().min(3).max(80),
      description: z.string().min(3).max(400),
      theme: z.string().max(40),
      submitDays: z.number().int().min(1).max(21),
      voteDays: z.number().int().min(1).max(14),
    }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const season = await sql<{ id: string; theme_key: string }>`
      select id, theme_key from seasons
      where starts_at <= now() and ends_at > now()
      order by starts_at desc
      limit 1
    `;
    const id = `ch_${crypto.randomUUID()}`;
    const image = "";
    await sql`
      insert into challenges (
        id, title, description, image_url, theme, start_date, end_date,
        points_first, points_second, points_third, is_demo, season_id,
        submissions_close, voting_close, vote_budget, participation_points, vote_points, results_published
      ) values (
        ${id}, ${data.title.trim()}, ${data.description.trim()}, ${image}, ${data.theme.trim() || "Weekly"},
        now(), now() + (${data.submitDays} + ${data.voteDays}) * interval '1 day',
        400, 180, 90, false, ${season[0]?.id ?? ""},
        now() + ${data.submitDays} * interval '1 day',
        now() + (${data.submitDays} + ${data.voteDays}) * interval '1 day',
        10, 25, 5, false
      )
    `;
    return { ok: true as const, id };
  });

export const closeChallenge = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const updated = await sql`
      update challenges
      set submissions_close = now(), voting_close = now(), end_date = now()
      where id = ${data.id} and is_demo = false and results_published = false
      returning id
    `;
    if (!updated.length) return { ok: false as const, error: "That challenge is already closed." };
    await awardIfDue(sql);
    return { ok: true as const };
  });

function mapPerson(row: Record<string, unknown>): PersonCard {
  return {
    id: String(row.user_id),
    username: String(row.username),
    bio: String(row.bio ?? ""),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    followers: asNum(row.followers),
    followedByMe: asBool(row.followed_by_me),
  };
}

export const getExplore = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ExplorePayload> => {
    const sql = await getSql();
    await awardIfDue(sql);
    const me = context.userId;
    const recommended = await sql<Record<string, unknown>>`
      select p.user_id, p.username, p.bio, p.avatar_url,
        (p.follower_base + (select count(*)::int from follows f where f.following_id = p.user_id)) as followers,
        false as followed_by_me
      from profiles p
      where p.user_id <> ${me}
        and p.is_demo = false
        and not exists (
          select 1 from follows f where f.follower_id = ${me} and f.following_id = p.user_id
        )
      order by p.follower_base desc, p.created_at desc
      limit 8
    `;
    const fresh = await sql<Record<string, unknown>>`
      select p.user_id, p.username, p.bio, p.avatar_url,
        (p.follower_base + (select count(*)::int from follows f where f.following_id = p.user_id)) as followers,
        exists(select 1 from follows f where f.follower_id = ${me} and f.following_id = p.user_id) as followed_by_me
      from profiles p
      where p.user_id <> ${me}
        and p.is_demo = false
      order by p.created_at desc
      limit 8
    `;
    const popular = await sql<{ id: string; image_url: string; username: string; like_count: number }>`
      select p.id, p.image_url, pr.username,
        (select count(*)::int from likes l where l.post_id = p.id) as like_count
      from posts p
      join profiles pr on pr.user_id = p.user_id
      where p.is_demo = false
      order by like_count desc, p.created_at desc
      limit 8
    `;
    const trending = await sql<{ id: string; image_url: string; username: string; like_count: number }>`
      select p.id, p.image_url, pr.username,
        (select count(*)::int from likes l where l.post_id = p.id) as like_count
      from posts p
      join profiles pr on pr.user_id = p.user_id
      where p.created_at > now() - interval '21 days'
        and p.is_demo = false
      order by like_count desc, p.created_at desc
      limit 8
    `;
    const winners = await sql<Record<string, unknown>>`
      select p.id as post_id, p.image_url, pr.username, pr.avatar_url,
        c.id as challenge_id, c.title as challenge_title, r.points
      from challenge_results r
      join challenges c on c.id = r.challenge_id
      join challenge_submissions s on s.challenge_id = r.challenge_id and s.user_id = r.user_id
      join posts p on p.id = s.post_id
      join profiles pr on pr.user_id = r.user_id
      where r.place = 1
        and c.is_demo = false
        and c.results_published = true
      order by c.end_date desc
      limit 4
    `;
    const lookbook = await sql<{ id: string; image_url: string; username: string; like_count: number }>`
      select p.id, p.image_url, pr.username,
        (select count(*)::int from likes l where l.post_id = p.id) as like_count
      from posts p
      join profiles pr on pr.user_id = p.user_id
      where p.is_demo = true
      order by p.created_at desc
      limit 12
    `;
    return {
      recommended: recommended.map(mapPerson),
      newUsers: fresh.map(mapPerson),
      popular: popular.map((p) => ({
        id: p.id, imageUrl: p.image_url, username: p.username, likeCount: asNum(p.like_count),
      })),
      trending: trending.map((p) => ({
        id: p.id, imageUrl: p.image_url, username: p.username, likeCount: asNum(p.like_count),
      })),
      lookbook: lookbook.map((p) => ({
        id: p.id, imageUrl: p.image_url, username: p.username, likeCount: asNum(p.like_count),
      })),
      winners: winners.map((w) => ({
        postId: String(w.post_id),
        imageUrl: String(w.image_url),
        username: String(w.username),
        avatarUrl: w.avatar_url ? String(w.avatar_url) : null,
        challengeId: String(w.challenge_id),
        challengeTitle: String(w.challenge_title),
        points: asNum(w.points),
      })),
    };
  });

export const updatePost = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      postId: z.string().min(1).max(80),
      caption: z.string().max(300),
      removePositions: z.array(z.number().int().min(0).max(30)).max(16).optional(),
    }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const mine = await sql`select id from posts where id = ${data.postId} and user_id = ${context.userId}`;
    if (!mine.length) return { ok: false as const, error: "You can only edit your own look." };
    const rows = await sql<{ image_url: string }>`
      select image_url from post_images where post_id = ${data.postId} order by position asc
    `;
    const gallery = rows.length
      ? rows
      : await sql<{ image_url: string }>`select image_url from posts where id = ${data.postId}`;
    const remove = new Set(data.removePositions ?? []);
    const kept = gallery.filter((_, index) => !remove.has(index)).map((row) => row.image_url);
    if (!kept.length) return { ok: false as const, error: "A look needs at least one photo." };
    await sql`update posts set caption = ${data.caption.trim()}, image_url = ${kept[0]} where id = ${data.postId}`;
    await sql`delete from post_images where post_id = ${data.postId}`;
    for (let i = 0; i < kept.length; i += 1) {
      await sql`
        insert into post_images (post_id, position, image_url)
        values (${data.postId}, ${i}, ${kept[i]})
      `;
    }
    return { ok: true as const, images: kept };
  });

export const deletePost = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ postId: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const removed = await sql`
      delete from posts where id = ${data.postId} and user_id = ${context.userId} returning id
    `;
    if (!removed.length) return { ok: false as const, error: "You can only delete your own look." };
    return { ok: true as const };
  });

export const requestVerification = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ message: z.string().max(400) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await sql<{ verified: boolean | string; role: string }>`
      select verified, role from profiles where user_id = ${context.userId}
    `;
    if (!profile.length) return { ok: false as const, error: "Finish your profile first." };
    if (asBool(profile[0].verified) || profile[0].role === "founder") {
      return { ok: false as const, error: "This account is already verified." };
    }
    const pending = await sql`
      select id from verification_requests where user_id = ${context.userId} and status = 'pending'
    `;
    if (pending.length) return { ok: false as const, error: "You already have a request waiting." };
    await sql`
      insert into verification_requests (id, user_id, message, status)
      values (${`vr_${crypto.randomUUID()}`}, ${context.userId}, ${data.message.trim()}, 'pending')
    `;
    return { ok: true as const };
  });
