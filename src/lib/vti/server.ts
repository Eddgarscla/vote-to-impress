import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import type {
  ChallengeDetail,
  ChallengeSummary,
  CommentItem,
  ExplorePayload,
  PersonCard,
  Placement,
  PostCard,
  ProfilePayload,
  RankedLook,
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
};

function mapPost(r: PostRow): PostCard {
  return {
    id: r.id,
    imageUrl: r.image_url,
    caption: r.caption,
    createdAt: toIso(r.created_at),
    likeCount: asNum(r.like_count),
    commentCount: asNum(r.comment_count),
    likedByMe: asBool(r.liked_by_me),
    challenge: r.challenge_id ? { id: r.challenge_id, title: r.challenge_title ?? "" } : null,
    author: { id: r.author_id, username: r.username, avatarUrl: r.avatar_url },
  };
}

async function awardIfDue(sql: Sql) {
  const due = await sql<{ id: string }>`
    select c.id
    from challenges c
    where c.end_date <= now()
      and not exists (select 1 from challenge_results r where r.challenge_id = c.id)
  `;
  for (const row of due) {
    const meta = await sql<{ points_first: number; points_second: number; points_third: number }>`
      select points_first, points_second, points_third from challenges where id = ${row.id}
    `;
    const points = meta[0];
    if (!points) continue;
    const ranked = await sql<{ user_id: string }>`
      select s.user_id
      from challenge_submissions s
      left join votes v on v.submission_id = s.id
      where s.challenge_id = ${row.id}
      group by s.user_id, s.created_at
      order by count(v.voter_id) desc, s.created_at asc
    `;
    let place = 0;
    for (const entry of ranked) {
      place += 1;
      const award =
        place === 1 ? asNum(points.points_first) : place === 2 ? asNum(points.points_second) : place === 3 ? asNum(points.points_third) : 0;
      const inserted = await sql<{ user_id: string }>`
        insert into challenge_results (challenge_id, user_id, place, points)
        values (${row.id}, ${entry.user_id}, ${place}, ${award})
        on conflict (challenge_id, user_id) do nothing
        returning user_id
      `;
      if (!inserted.length) continue;
      await sql`
        update profiles
        set impress_points = impress_points + ${award},
            challenge_wins = challenge_wins + ${place === 1 ? 1 : 0},
            top_placements = top_placements + ${place <= 3 ? 1 : 0}
        where user_id = ${entry.user_id}
      `;
    }
  }
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
    return { ok: true as const, username };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      username: z.string().max(20),
      bio: z.string().max(160),
      avatarDataUrl: z.string().max(700_000).nullable().optional(),
    }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const username = data.username.trim().toLowerCase();
    const bio = data.bio.trim();
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
    if (data.avatarDataUrl) {
      await sql`
        update profiles set username = ${username}, bio = ${bio}, avatar_url = ${data.avatarDataUrl}
        where user_id = ${context.userId}
      `;
    } else {
      await sql`update profiles set username = ${username}, bio = ${bio} where user_id = ${context.userId}`;
    }
    return { ok: true as const, username };
  });

async function loadProfile(sql: Sql, me: string, username?: string): Promise<ProfilePayload | null> {
  const rows = username
    ? await sql<Record<string, unknown>>`
        select p.user_id, p.username, p.bio, p.avatar_url, p.impress_points, p.challenge_wins, p.top_placements,
          (p.follower_base + (select count(*)::int from follows f where f.following_id = p.user_id)) as followers,
          (p.following_base + (select count(*)::int from follows f where f.follower_id = p.user_id)) as following_count,
          (select count(*)::int from posts po where po.user_id = p.user_id) as post_count,
          exists(select 1 from follows f where f.follower_id = ${me} and f.following_id = p.user_id) as followed_by_me
        from profiles p
        where p.username = ${username}
      `
    : await sql<Record<string, unknown>>`
        select p.user_id, p.username, p.bio, p.avatar_url, p.impress_points, p.challenge_wins, p.top_placements,
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
  const posts = await sql<{ id: string; image_url: string }>`
    select id, image_url from posts where user_id = ${id} order by created_at desc
  `;
  const placements = await sql<{ challenge_id: string; title: string; place: number; points: number }>`
    select c.id as challenge_id, c.title, r.place, r.points
    from challenge_results r
    join challenges c on c.id = r.challenge_id
    where r.user_id = ${id}
    order by c.end_date desc
    limit 6
  `;
  let email: string | null = null;
  const isSelf = id === me;
  if (isSelf) {
    const auth = await sql<{ email: string }>`select "email" as email from "user" where "id" = ${me}`;
    email = auth[0]?.email ?? null;
  }
  const mapped: Placement[] = placements.map((p) => ({
    challengeId: p.challenge_id,
    challengeTitle: p.title,
    place: asNum(p.place),
    points: asNum(p.points),
  }));
  return {
    id,
    username: String(row.username),
    bio: String(row.bio ?? ""),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    email,
    isSelf,
    followedByMe: asBool(row.followed_by_me),
    followers: asNum(row.followers),
    following: asNum(row.following_count),
    postCount: asNum(row.post_count),
    impressPoints: asNum(row.impress_points),
    challengeWins: asNum(row.challenge_wins),
    topPlacements: asNum(row.top_placements),
    posts: posts.map((p) => ({ id: p.id, imageUrl: p.image_url })),
    placements: mapped,
  };
}

export const getProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ username: z.string().max(20).optional() }).parse(input ?? {}))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
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
            pr.user_id as author_id, pr.username, pr.avatar_url
          from posts p
          join profiles pr on pr.user_id = p.user_id
          left join challenges c on c.id = p.challenge_id
          where p.user_id = ${me}
             or p.user_id in (select following_id from follows where follower_id = ${me})
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
            pr.user_id as author_id, pr.username, pr.avatar_url
          from posts p
          join profiles pr on pr.user_id = p.user_id
          left join challenges c on c.id = p.challenge_id
          order by (
            (select count(*) from likes l where l.post_id = p.id) * 2
            + (select count(*) from comments cm where cm.post_id = p.id)
          ) desc, p.created_at desc
          limit 40
        `;
    return rows.map(mapPost);
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
        pr.user_id as author_id, pr.username, pr.avatar_url
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
        pr.user_id as author_id, pr.username, pr.avatar_url
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
    return { post: mapPost(rows[0]), comments: thread };
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
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    imageUrl: String(row.image_url),
    theme: String(row.theme ?? ""),
    startDate: toIso(row.start_date),
    endDate: toIso(row.end_date),
    phase: asBool(row.ended) ? "ended" : "active",
    participants: asNum(row.participants),
    pointsFirst: asNum(row.points_first),
    pointsSecond: asNum(row.points_second),
    pointsThird: asNum(row.points_third),
  };
}

export const listChallenges = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    await awardIfDue(sql);
    const rows = await sql<Record<string, unknown>>`
      select c.id, c.title, c.description, c.image_url, c.theme,
        c.start_date::text as start_date, c.end_date::text as end_date,
        (c.end_date <= now()) as ended,
        c.points_first, c.points_second, c.points_third,
        (select count(*)::int from challenge_submissions s where s.challenge_id = c.id) as participants
      from challenges c
      order by (c.end_date <= now()) asc, c.end_date asc
    `;
    return rows.map(mapChallenge);
  });

function pointsLabel(place: number, ended: boolean, points: number): string {
  if (place > 3 || points <= 0) return "";
  return ended ? `${points} pts` : `${points} pts if it holds`;
}

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
        (c.end_date <= now()) as ended,
        c.points_first, c.points_second, c.points_third,
        (select count(*)::int from challenge_submissions s where s.challenge_id = c.id) as participants
      from challenges c
      where c.id = ${data.id}
    `;
    if (!rows[0]) return null;
    const summary = mapChallenge(rows[0]);
    const subs = await sql<Record<string, unknown>>`
      select s.id, s.post_id, s.user_id, s.created_at::text as created_at,
        pr.username, pr.avatar_url, p.image_url, p.caption,
        count(v.voter_id)::int as votes,
        exists(select 1 from votes mv where mv.submission_id = s.id and mv.voter_id = ${me}) as voted_by_me
      from challenge_submissions s
      join profiles pr on pr.user_id = s.user_id
      join posts p on p.id = s.post_id
      left join votes v on v.submission_id = s.id
      where s.challenge_id = ${data.id}
      group by s.id, s.post_id, s.user_id, s.created_at, pr.username, pr.avatar_url, p.image_url, p.caption
      order by count(v.voter_id) desc, s.created_at asc
    `;
    const awarded = await sql<{ user_id: string; points: number }>`
      select user_id, points from challenge_results where challenge_id = ${data.id}
    `;
    const awardMap = new Map(awarded.map((a) => [a.user_id, asNum(a.points)]));
    const ended = summary.phase === "ended";
    const ranking: RankedLook[] = subs.map((s, index) => {
      const place = index + 1;
      const projected = place === 1 ? summary.pointsFirst : place === 2 ? summary.pointsSecond : place === 3 ? summary.pointsThird : 0;
      const stored = awardMap.get(String(s.user_id));
      const points = stored ?? projected;
      return {
        submissionId: String(s.id),
        postId: String(s.post_id),
        userId: String(s.user_id),
        username: String(s.username),
        avatarUrl: s.avatar_url ? String(s.avatar_url) : null,
        imageUrl: String(s.image_url),
        caption: String(s.caption ?? ""),
        votes: asNum(s.votes),
        votedByMe: asBool(s.voted_by_me),
        place,
        points,
        pointsLabel: pointsLabel(place, ended, points),
      };
    });
    const mine = ranking.find((r) => r.userId === me) ?? null;
    const eligible = mine
      ? []
      : await sql<{ id: string; image_url: string; caption: string }>`
          select id, image_url, caption from posts
          where user_id = ${me} and challenge_id is null
          order by created_at desc
          limit 12
        `;
    return {
      ...summary,
      ranking,
      mySubmissionId: mine?.submissionId ?? null,
      eligiblePosts: eligible.map((p) => ({ id: p.id, imageUrl: p.image_url, caption: p.caption })),
    };
  });

async function challengeOpen(sql: Sql, challengeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await sql<{ ended: boolean | string }>`
    select (end_date <= now()) as ended from challenges where id = ${challengeId}
  `;
  if (!rows.length) return { ok: false, error: "That challenge is not here." };
  if (asBool(rows[0].ended)) return { ok: false, error: "This challenge has closed." };
  return { ok: true };
}

export const createPost = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      imageDataUrl: z.string().min(32).max(1_800_000),
      caption: z.string().max(300),
      challengeId: z.string().max(80).nullable().optional(),
    }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const bad = assertImage(data.imageDataUrl, 1_800_000);
    if (bad) return { ok: false as const, error: bad };
    const caption = data.caption.trim();
    const challengeId = data.challengeId || null;
    const sql = await getSql();
    const me = context.userId;
    const profile = await sql`select user_id from profiles where user_id = ${me}`;
    if (!profile.length) return { ok: false as const, error: "Finish your profile first." };
    if (challengeId) {
      const open = await challengeOpen(sql, challengeId);
      if (!open.ok) return open;
      const already = await sql`
        select id from challenge_submissions where challenge_id = ${challengeId} and user_id = ${me}
      `;
      if (already.length) return { ok: false as const, error: "You already entered this challenge." };
    }
    const postId = `p_${crypto.randomUUID()}`;
    await sql`
      insert into posts (id, user_id, image_url, caption, challenge_id)
      values (${postId}, ${me}, ${data.imageDataUrl}, ${caption}, ${challengeId})
    `;
    if (challengeId) {
      await sql`
        insert into challenge_submissions (id, challenge_id, post_id, user_id)
        values (${`s_${crypto.randomUUID()}`}, ${challengeId}, ${postId}, ${me})
      `;
    }
    return { ok: true as const, id: postId, challengeId };
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
    const already = await sql`
      select id from challenge_submissions where challenge_id = ${data.challengeId} and user_id = ${me}
    `;
    if (already.length) return { ok: false as const, error: "You already entered this challenge." };
    const post = await sql<{ challenge_id: string | null }>`
      select challenge_id from posts where id = ${data.postId} and user_id = ${me}
    `;
    if (!post.length) return { ok: false as const, error: "That look is not yours." };
    if (post[0].challenge_id) return { ok: false as const, error: "That look is already in a challenge." };
    await sql`update posts set challenge_id = ${data.challengeId} where id = ${data.postId} and user_id = ${me}`;
    await sql`
      insert into challenge_submissions (id, challenge_id, post_id, user_id)
      values (${`s_${crypto.randomUUID()}`}, ${data.challengeId}, ${data.postId}, ${me})
    `;
    return { ok: true as const };
  });

export const toggleVote = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ submissionId: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    const sub = await sql<{ user_id: string; challenge_id: string; ended: boolean | string }>`
      select s.user_id, s.challenge_id, (c.end_date <= now()) as ended
      from challenge_submissions s
      join challenges c on c.id = s.challenge_id
      where s.id = ${data.submissionId}
    `;
    if (!sub.length) return { ok: false as const, error: "That entry is not here." };
    if (asBool(sub[0].ended)) return { ok: false as const, error: "Voting is closed." };
    if (sub[0].user_id === me) return { ok: false as const, error: "You cannot vote for your own look." };
    const existing = await sql`
      select 1 as one from votes where voter_id = ${me} and submission_id = ${data.submissionId}
    `;
    if (existing.length) {
      await sql`delete from votes where voter_id = ${me} and submission_id = ${data.submissionId}`;
    } else {
      await sql`insert into votes (voter_id, submission_id) values (${me}, ${data.submissionId})`;
    }
    const count = await sql<{ n: number }>`
      select count(*)::int as n from votes where submission_id = ${data.submissionId}
    `;
    return { ok: true as const, voted: !existing.length, votes: asNum(count[0]?.n) };
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
      order by p.created_at desc
      limit 8
    `;
    const popular = await sql<{ id: string; image_url: string; username: string; like_count: number }>`
      select p.id, p.image_url, pr.username,
        (select count(*)::int from likes l where l.post_id = p.id) as like_count
      from posts p
      join profiles pr on pr.user_id = p.user_id
      order by like_count desc, p.created_at desc
      limit 8
    `;
    const trending = await sql<{ id: string; image_url: string; username: string; like_count: number }>`
      select p.id, p.image_url, pr.username,
        (select count(*)::int from likes l where l.post_id = p.id) as like_count
      from posts p
      join profiles pr on pr.user_id = p.user_id
      where p.created_at > now() - interval '21 days'
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
      order by c.end_date desc
      limit 4
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
