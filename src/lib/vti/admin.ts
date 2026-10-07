import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { FOUNDER_EMAIL, isFounderEmail } from "@/lib/vti/founder";
import type { ChallengePhase, FounderDesk } from "@/lib/vti/types";

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "t" || v === "true" || v === "1";
  return false;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? String(v ?? "") : d.toISOString();
}

function parseWhen(value: string): Date {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return new Date(`${v}:00.000Z`);
  return new Date(v);
}

async function requireFounder(sql: Sql, userId: string) {
  const rows = await sql<{ role: string; email: string }>`
    select p.role, u."email" as email
    from profiles p
    join "user" u on u."id" = p.user_id
    where p.user_id = ${userId} and p.is_demo = false and p.is_test = false
  `;
  if (rows[0]?.role !== "founder" || !isFounderEmail(rows[0]?.email)) {
    return { ok: false as const, error: "Only the Founder can manage the platform." };
  }
  return { ok: true as const };
}

export const getFounderDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<FounderDesk | { error: string }> => {
    const sql = await getSql();
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
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return { error: allowed.error };
    const stats = await sql<{ users: number; posts: number; votes: number; pending: number }>`
      select
        (select count(*)::int from profiles where is_demo = false) as users,
        (select count(*)::int from posts where is_demo = false) as posts,
        (select count(*)::int from votes) as votes,
        (select count(*)::int from verification_requests where status = 'pending') as pending
    `;
    const settings = await sql<{ theme_key: string; weekly_theme: string; monthly_theme: string }>`
      select theme_key, weekly_theme, monthly_theme from platform_settings where id = 'current'
    `;
    const levels = await sql<{ level_key: string; label: string; min_points: number }>`
      select level_key, label, min_points from level_thresholds order by sort_order asc, min_points asc
    `;
    const challenges = await sql<Record<string, unknown>>`
      select c.id, c.title, c.description, c.theme, c.kind, c.active, c.cancelled, c.results_published,
        c.start_date::text as start_date, c.end_date::text as end_date,
        c.points_first, c.points_second, c.points_third, c.participation_points, c.vote_budget,
        case
          when coalesce(c.cancelled, false) then 'ended'
          when coalesce(c.active, true) = false then 'paused'
          when now() < c.start_date then 'upcoming'
          when now() >= coalesce(c.voting_close, c.end_date) then 'ended'
          when now() >= coalesce(c.submissions_close, c.end_date) then 'voting'
          else 'open'
        end as phase,
        (select count(*)::int from challenge_submissions s where s.challenge_id = c.id) as participants,
        (select count(*)::int from votes v join challenge_submissions s on s.id = v.submission_id where s.challenge_id = c.id) as votes
      from challenges c
      where c.is_demo = false
      order by c.start_date desc
    `;
    const ranking = await sql<{ challenge_id: string; username: string; votes: number }>`
      select s.challenge_id, pr.username, count(v.voter_id)::int as votes
      from challenge_submissions s
      join profiles pr on pr.user_id = s.user_id
      left join votes v on v.submission_id = s.id
      where pr.is_demo = false
      group by s.challenge_id, pr.username, s.created_at
      order by count(v.voter_id) desc, s.created_at asc
    `;
    const requests = await sql<Record<string, unknown>>`
      select r.id, r.user_id, r.message, r.status, pr.username, pr.impress_points,
        (pr.follower_base + (select count(*)::int from follows f where f.following_id = pr.user_id)) as followers,
        (pr.following_base + (select count(*)::int from follows f where f.follower_id = pr.user_id)) as following_count,
        (select count(*)::int from challenge_submissions s where s.user_id = pr.user_id) as entries,
        coalesce((select label from level_thresholds t where t.min_points <= pr.impress_points order by t.min_points desc limit 1), 'New Face') as level_label
      from verification_requests r
      join profiles pr on pr.user_id = r.user_id
      order by (r.status = 'pending') desc, r.created_at desc
      limit 40
    `;
    const people = await sql<Record<string, unknown>>`
      select p.user_id, p.username, p.impress_points, p.verified, p.is_test, p.role, u."email" as email,
        coalesce((select label from level_thresholds t where t.min_points <= p.impress_points order by t.min_points desc limit 1), 'New Face') as level_label
      from profiles p
      left join "user" u on u."id" = p.user_id
      where p.is_demo = false
      order by p.impress_points desc, p.username asc
      limit 40
    `;
    const byChallenge = new Map<string, { username: string; votes: number }[]>();
    for (const row of ranking) {
      const list = byChallenge.get(row.challenge_id) ?? [];
      list.push({ username: row.username, votes: asNum(row.votes) });
      byChallenge.set(row.challenge_id, list);
    }
    const submissions = await sql<Record<string, unknown>>`
      select s.challenge_id, pr.username, p.image_url,
        (select count(*)::int from votes v where v.submission_id = s.id) as votes,
        r.place, r.points
      from challenge_submissions s
      join posts p on p.id = s.post_id
      join profiles pr on pr.user_id = s.user_id
      left join challenge_results r on r.challenge_id = s.challenge_id and r.user_id = s.user_id
      where pr.is_demo = false
      order by s.challenge_id, coalesce(r.place, 999), votes desc, s.created_at asc
    `;
    const voterRows = await sql<{ challenge_id: string; voters: number }>`
      select s.challenge_id, count(distinct v.voter_id)::int as voters
      from challenge_submissions s
      join votes v on v.submission_id = s.id
      group by s.challenge_id
    `;
    const subsByChallenge = new Map<string, { username: string; imageUrl: string; votes: number; place: number | null; points: number | null }[]>();
    for (const row of submissions) {
      const id = String(row.challenge_id);
      const list = subsByChallenge.get(id) ?? [];
      list.push({
        username: String(row.username),
        imageUrl: String(row.image_url),
        votes: asNum(row.votes),
        place: row.place == null ? null : asNum(row.place),
        points: row.points == null ? null : asNum(row.points),
      });
      subsByChallenge.set(id, list);
    }
    const votersByChallenge = new Map(voterRows.map((row) => [row.challenge_id, asNum(row.voters)]));
    return {
      stats: {
        users: asNum(stats[0]?.users),
        posts: asNum(stats[0]?.posts),
        votes: asNum(stats[0]?.votes),
        pending: asNum(stats[0]?.pending),
      },
      themeKey: settings[0]?.theme_key ?? "haunted",
      weeklyTheme: settings[0]?.weekly_theme ?? "",
      monthlyTheme: settings[0]?.monthly_theme ?? "",
      levels: levels.map((level) => ({ key: level.level_key, label: level.label, min: asNum(level.min_points) })),
      challenges: challenges.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        description: String(row.description),
        theme: String(row.theme ?? ""),
        kind: String(row.kind) === "monthly" ? "monthly" as const : "weekly" as const,
        phase: String(row.phase) as ChallengePhase,
        active: asBool(row.active),
        cancelled: asBool(row.cancelled),
        startDate: toIso(row.start_date),
        endDate: toIso(row.end_date),
        participants: asNum(row.participants),
        votes: asNum(row.votes),
        pointsFirst: asNum(row.points_first),
        pointsSecond: asNum(row.points_second),
        pointsThird: asNum(row.points_third),
        participationPoints: asNum(row.participation_points) || 25,
        voteBudget: asNum(row.vote_budget) || 10,
        resultsPublic: asBool(row.results_published),
        ranking: byChallenge.get(String(row.id)) ?? [],
        voters: votersByChallenge.get(String(row.id)) ?? 0,
        submissions: subsByChallenge.get(String(row.id)) ?? [],
        winner: (byChallenge.get(String(row.id)) ?? [])[0]?.username ?? null,
      })),
      requests: requests.map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        username: String(row.username),
        message: String(row.message ?? ""),
        status: String(row.status),
        followers: asNum(row.followers),
        following: asNum(row.following_count),
        impressPoints: asNum(row.impress_points),
        levelLabel: String(row.level_label),
        entries: asNum(row.entries),
      })),
      people: people.map((row) => ({
        id: String(row.user_id),
        username: String(row.username),
        email: row.email ? String(row.email) : null,
        impressPoints: asNum(row.impress_points),
        levelLabel: String(row.level_label),
        verified: asBool(row.verified),
        isTest: asBool(row.is_test),
        role: String(row.role) === "founder" && isFounderEmail(row.email ? String(row.email) : null) && !asBool(row.is_test) ? "founder" as const : "member" as const,
      })),
      testAccounts: [
        { username: "miraquill", email: "miraquill@test.votetoimpress.app", password: "RunwayTest1" },
        { username: "juniperlane", email: "juniperlane@test.votetoimpress.app", password: "RunwayTest1" },
        { username: "cassvelvet", email: "cassvelvet@test.votetoimpress.app", password: "RunwayTest1" },
        { username: "orioframe", email: "orioframe@test.votetoimpress.app", password: "RunwayTest1" },
      ],
    };
  });

const challengeInput = z.object({
  id: z.string().max(80).optional(),
  title: z.string().min(3).max(80),
  description: z.string().min(3).max(400),
  theme: z.string().max(60),
  kind: z.enum(["weekly", "monthly"]),
  startsAt: z.string().min(8).max(40),
  endsAt: z.string().min(8).max(40),
  pointsFirst: z.number().int().min(0).max(10000),
  pointsSecond: z.number().int().min(0).max(10000),
  pointsThird: z.number().int().min(0).max(10000),
  participationPoints: z.number().int().min(0).max(10000).optional(),
  voteBudget: z.number().int().min(1).max(50).optional(),
});

export const saveFounderChallenge = createServerFn({ method: "POST" })
  .validator((input: unknown) => challengeInput.parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const start = parseWhen(data.startsAt);
    const end = parseWhen(data.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { ok: false as const, error: "The end has to be after the start." };
    }
    const participation = data.participationPoints ?? 25;
    const budget = data.voteBudget ?? 10;
    const themeRow = await sql<{ theme_key: string }>`select theme_key from platform_settings where id = 'current'`;
    const image = themeRow[0]?.theme_key === "haunted" ? "/media/brand/haunted.jpg" : "/media/brand/lineup.jpg";
    if (data.id) {
      const updated = await sql`
        update challenges set
          title = ${data.title.trim()},
          description = ${data.description.trim()},
          theme = ${data.theme.trim()},
          kind = ${data.kind},
          start_date = ${start.toISOString()},
          end_date = ${end.toISOString()},
          submissions_close = ${end.toISOString()},
          voting_close = ${end.toISOString()},
          points_first = ${data.pointsFirst},
          points_second = ${data.pointsSecond},
          points_third = ${data.pointsThird},
          participation_points = ${participation},
          vote_budget = ${budget}
        where id = ${data.id} and is_demo = false and results_published = false
        returning id
      `;
      if (!updated.length) return { ok: false as const, error: "That challenge is closed or not editable." };
      return { ok: true as const, id: data.id };
    }
    const id = `ch_${crypto.randomUUID()}`;
    const season = await sql<{ id: string }>`
      select id from seasons where starts_at <= now() and ends_at > now() order by starts_at desc limit 1
    `;
    await sql`
      insert into challenges (
        id, title, description, image_url, theme, start_date, end_date,
        points_first, points_second, points_third, is_demo, season_id,
        submissions_close, voting_close, vote_budget, participation_points, vote_points,
        results_published, kind, active, cancelled
      ) values (
        ${id}, ${data.title.trim()}, ${data.description.trim()}, ${image}, ${data.theme.trim() || data.kind},
        ${start.toISOString()}, ${end.toISOString()},
        ${data.pointsFirst}, ${data.pointsSecond}, ${data.pointsThird}, false, ${season[0]?.id ?? ""},
        ${end.toISOString()}, ${end.toISOString()}, ${budget}, ${participation}, 5, false, ${data.kind}, true, false
      )
    `;
    return { ok: true as const, id };
  });

export const setChallengeState = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().min(1).max(80), action: z.enum(["activate", "pause", "cancel"]) }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    if (data.action === "cancel") {
      await sql`
        update challenges
        set cancelled = true, active = false, results_published = false
        where id = ${data.id} and is_demo = false
      `;
      return { ok: true as const };
    }
    await sql`
      update challenges set active = ${data.action === "activate"}
      where id = ${data.id} and is_demo = false and cancelled = false
    `;
    return { ok: true as const };
  });

export const reviewVerification = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().min(1).max(80), decision: z.enum(["approve", "reject"]) }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const request = await sql<{ user_id: string }>`
      select user_id from verification_requests where id = ${data.id} and status = 'pending'
    `;
    if (!request.length) return { ok: false as const, error: "That request is no longer pending." };
    await sql`
      update verification_requests
      set status = ${data.decision === "approve" ? "approved" : "rejected"},
          reviewed_at = now(),
          reviewer_id = ${context.userId}
      where id = ${data.id}
    `;
    if (data.decision === "approve") {
      await sql`update profiles set verified = true where user_id = ${request[0].user_id} and role <> 'founder'`;
    }
    return { ok: true as const };
  });

export const revokeVerification = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ userId: z.string().min(1).max(80) }).parse(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const target = await sql<{ role: string; email: string }>`
      select p.role, u."email" as email
      from profiles p
      left join "user" u on u."id" = p.user_id
      where p.user_id = ${data.userId}
    `;
    if (target[0]?.role === "founder" || isFounderEmail(target[0]?.email)) {
      return { ok: false as const, error: "The Founder stays verified." };
    }
    await sql`update profiles set verified = false where user_id = ${data.userId}`;
    return { ok: true as const };
  });

export const saveLevelLadder = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      levels: z.array(z.object({
        key: z.string().min(2).max(40),
        label: z.string().min(2).max(40),
        min: z.number().int().min(0).max(1000000),
      })).min(1).max(12),
    }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const levels = [...data.levels].sort((a, b) => a.min - b.min);
    if (levels[0].min !== 0) return { ok: false as const, error: "The first level has to start at 0 points." };
    for (const level of levels) {
      await sql`
        insert into level_thresholds (level_key, label, min_points, sort_order)
        values (${level.key}, ${level.label.trim()}, ${level.min}, ${levels.indexOf(level) + 1})
        on conflict (level_key) do update set label = excluded.label, min_points = excluded.min_points, sort_order = excluded.sort_order
      `;
    }
    await sql.query(`
      update profiles set level_key = coalesce((
        select level_key from level_thresholds t
        where t.min_points <= profiles.impress_points
        order by t.min_points desc
        limit 1
      ), 'new_face')
    `);
    return { ok: true as const };
  });

export const savePlatformTheme = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      themeKey: z.enum(["gloss", "haunted", "frost", "valentine"]),
      weeklyTheme: z.string().max(80),
      monthlyTheme: z.string().max(80),
    }).parse(input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    await sql`
      insert into platform_settings (id, theme_key, weekly_theme, monthly_theme)
      values ('current', ${data.themeKey}, ${data.weeklyTheme.trim()}, ${data.monthlyTheme.trim()})
      on conflict (id) do update set
        theme_key = excluded.theme_key,
        weekly_theme = excluded.weekly_theme,
        monthly_theme = excluded.monthly_theme
    `;
    return { ok: true as const };
  });
