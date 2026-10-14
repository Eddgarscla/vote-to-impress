import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { isFounderEmail } from "@/lib/vti/founder";
import type { RewardBand, StageCard, TwistCard, VoteRules, VoteWallet } from "@/lib/vti/types";
import { settleWallet } from "@/lib/vti/wallet";

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
  if (!v) return "";
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
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

export async function loadVoteRules(sql: Sql): Promise<VoteRules> {
  const rows = await sql<Record<string, unknown>>`
    select vote_max, vote_regen, vote_interval_minutes, allow_multi_vote, vote_expiry, bonus_votes
    from platform_settings where id = 'current'
  `;
  const row = rows[0] ?? {};
  return {
    max: Math.max(1, asNum(row.vote_max) || 10),
    regen: Math.max(0, asNum(row.vote_regen) || 1),
    intervalMinutes: Math.max(1, asNum(row.vote_interval_minutes) || 60),
    allowMulti: asBool(row.allow_multi_vote),
    expiry: asBool(row.vote_expiry),
    bonus: asBool(row.bonus_votes),
  };
}

export async function refreshWallet(sql: Sql, userId: string): Promise<VoteWallet & VoteRules> {
  const rules = await loadVoteRules(sql);
  if (rules.expiry) {
    const windowMinutes = rules.intervalMinutes * rules.max;
    const removed = await sql<{ n: number }>`
      with old as (
        delete from votes v
        using challenge_submissions s, challenges c
        where v.submission_id = s.id
          and s.challenge_id = c.id
          and v.voter_id = ${userId}
          and v.created_at <= now() - (${windowMinutes} * interval '1 minute')
          and coalesce(c.voting_close, c.end_date) > now()
          and coalesce(c.cancelled, false) = false
        returning 1
      )
      select count(*)::int as n from old
    `;
    const refund = asNum(removed[0]?.n);
    if (refund > 0) {
      await sql`
        insert into vote_wallets (user_id, balance, updated_at)
        values (${userId}, ${Math.min(rules.max, refund)}, now())
        on conflict (user_id) do update
        set balance = least(${rules.max}, vote_wallets.balance + ${refund})
      `;
    }
  }
  const existing = await sql<{ balance: number; updated_at: string | Date }>`
    select balance, updated_at from vote_wallets where user_id = ${userId}
  `;
  const now = Date.now();
  const rawBalance = existing.length ? asNum(existing[0].balance) : rules.max;
  const rawUpdated = existing.length ? new Date(existing[0].updated_at).getTime() : now;
  const settled = settleWallet({
    balance: rawBalance,
    updatedAtMs: Number.isFinite(rawUpdated) ? rawUpdated : now,
    nowMs: now,
    max: rules.max,
    regen: rules.regen,
    intervalMinutes: rules.intervalMinutes,
  });
  await sql`
    insert into vote_wallets (user_id, balance, updated_at)
    values (${userId}, ${settled.balance}, ${new Date(settled.updatedAtMs).toISOString()})
    on conflict (user_id) do update
    set balance = excluded.balance, updated_at = excluded.updated_at
  `;
  return { ...rules, balance: settled.balance, nextInMs: settled.nextInMs };
}

export async function changeWallet(sql: Sql, userId: string, delta: number): Promise<VoteWallet & VoteRules> {
  const current = await refreshWallet(sql, userId);
  if (delta < 0 && current.balance + delta < 0) return current;
  const balance = Math.min(current.max, Math.max(0, current.balance + delta));
  const started = current.balance >= current.max && balance < current.max;
  const updated = started || balance >= current.max ? new Date().toISOString() : new Date(Date.now() - (current.nextInMs == null ? 0 : (current.intervalMinutes * 60_000 - current.nextInMs))).toISOString();
  await sql`
    update vote_wallets set balance = ${balance}, updated_at = ${updated} where user_id = ${userId}
  `;
  const next = await refreshWallet(sql, userId);
  return next;
}

export async function grantEntryBonus(sql: Sql, userId: string) {
  const rules = await loadVoteRules(sql);
  if (!rules.bonus || rules.regen <= 0) return;
  await refreshWallet(sql, userId);
  await sql`
    update vote_wallets
    set balance = least(${rules.max}, balance + ${rules.regen})
    where user_id = ${userId}
  `;
}

export async function openStageId(sql: Sql, challengeId: string): Promise<string> {
  const rows = await sql<{ id: string }>`
    select id from challenge_stages
    where challenge_id = ${challengeId} and starts_at <= now() and ends_at > now()
    order by sort_order asc, starts_at asc
    limit 1
  `;
  if (rows.length) return rows[0].id;
  const any = await sql<{ id: string }>`select id from challenge_stages where challenge_id = ${challengeId} limit 1`;
  return any.length ? "" : "";
}

export async function challengeHasStages(sql: Sql, challengeId: string): Promise<boolean> {
  const rows = await sql`select 1 as one from challenge_stages where challenge_id = ${challengeId} limit 1`;
  return rows.length > 0;
}

export async function loadStages(sql: Sql, challengeId?: string): Promise<StageCard[]> {
  const rows = challengeId
    ? await sql<Record<string, unknown>>`
        select id, challenge_id, title, description, requirement, starts_at, ends_at, sort_order,
          (starts_at <= now() and ends_at > now()) as open
        from challenge_stages where challenge_id = ${challengeId}
        order by sort_order asc, starts_at asc
      `
    : await sql<Record<string, unknown>>`
        select id, challenge_id, title, description, requirement, starts_at, ends_at, sort_order,
          (starts_at <= now() and ends_at > now()) as open
        from challenge_stages
        order by starts_at asc
      `;
  return rows.map((row) => ({
    id: String(row.id),
    challengeId: String(row.challenge_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    requirement: String(row.requirement ?? ""),
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    sortOrder: asNum(row.sort_order),
    open: asBool(row.open),
  }));
}

export async function loadTwists(sql: Sql, challengeId?: string, liveOnly = false): Promise<TwistCard[]> {
  const rows = await sql<Record<string, unknown>>`
    select id, challenge_id, title, description, requirement, image_url, starts_at, ends_at,
      (starts_at <= now() and ends_at > now()) as live
    from twist_drops
    where (${challengeId ?? null}::text is null or challenge_id = ${challengeId ?? ""})
      and (${liveOnly} = false or (starts_at <= now() and ends_at > now()))
    order by starts_at asc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    challengeId: String(row.challenge_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    requirement: String(row.requirement ?? ""),
    imageUrl: String(row.image_url ?? ""),
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    live: asBool(row.live),
  }));
}

export async function loadBands(sql: Sql): Promise<RewardBand[]> {
  const rows = await sql<Record<string, unknown>>`
    select id, scope, place_from, place_to, points
    from reward_bands
    order by scope asc, sort_order asc, place_from asc
  `;
  return rows.map((row) => ({
    id: String(row.id),
    scope: String(row.scope),
    placeFrom: asNum(row.place_from),
    placeTo: asNum(row.place_to),
    points: asNum(row.points),
  }));
}

export async function copyKindBands(sql: Sql, kind: string, challengeId: string) {
  const bands = await sql<{ place_from: number; place_to: number; points: number; sort_order: number }>`
    select place_from, place_to, points, sort_order from reward_bands where scope = ${`kind:${kind}`}
  `;
  let n = 0;
  for (const band of bands) {
    n += 1;
    await sql`
      insert into reward_bands (id, scope, place_from, place_to, points, sort_order)
      values (${`rb_${challengeId}_${n}`}, ${`challenge:${challengeId}`}, ${band.place_from}, ${band.place_to}, ${band.points}, ${band.sort_order})
      on conflict (id) do nothing
    `;
  }
}

const voteInput = z.object({
  max: z.number().int().min(1).max(100),
  regen: z.number().int().min(0).max(20),
  intervalMinutes: z.number().int().min(1).max(10080),
  allowMulti: z.boolean(),
  expiry: z.boolean(),
  bonus: z.boolean(),
});

export const saveVoteRules = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => voteInput.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    await sql`
      update platform_settings set
        vote_max = ${data.max},
        vote_regen = ${data.regen},
        vote_interval_minutes = ${data.intervalMinutes},
        allow_multi_vote = ${data.allowMulti},
        vote_expiry = ${data.expiry},
        bonus_votes = ${data.bonus}
      where id = 'current'
    `;
    return { ok: true as const };
  });

const bandInput = z.object({
  scope: z.string().min(3).max(120),
  bands: z.array(z.object({
    placeFrom: z.number().int().min(0).max(10000),
    placeTo: z.number().int().min(0).max(10000),
    points: z.number().int().min(0).max(100000),
  })).max(40),
});

export const saveRewardBands = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => bandInput.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    if (!/^(kind:(daily|weekly|monthly)|challenge:[A-Za-z0-9_-]{1,80})$/.test(data.scope)) {
      return { ok: false as const, error: "That reward table is not a daily, weekly, monthly, or challenge table." };
    }
    await sql`delete from reward_bands where scope = ${data.scope}`;
    let n = 0;
    for (const band of data.bands) {
      if (band.placeTo < band.placeFrom) return { ok: false as const, error: "A range cannot end before it starts." };
      n += 1;
      await sql`
        insert into reward_bands (id, scope, place_from, place_to, points, sort_order)
        values (${`rb_${data.scope.replace(/[^a-z0-9]+/gi, "_")}_${n}`}, ${data.scope}, ${band.placeFrom}, ${band.placeTo}, ${band.points}, ${n})
      `;
    }
    return { ok: true as const };
  });

const stageInput = z.object({
  id: z.string().max(80).optional(),
  challengeId: z.string().min(1).max(80),
  title: z.string().min(2).max(80),
  description: z.string().max(400),
  requirement: z.string().max(200),
  startsAt: z.string().min(8).max(40),
  endsAt: z.string().min(8).max(40),
  sortOrder: z.number().int().min(0).max(50),
});

export const saveStage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => stageInput.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const start = parseWhen(data.startsAt);
    const end = parseWhen(data.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { ok: false as const, error: "The stage end has to be after the start." };
    }
    const id = data.id || `st_${crypto.randomUUID()}`;
    await sql`
      insert into challenge_stages (id, challenge_id, title, description, requirement, starts_at, ends_at, sort_order)
      values (${id}, ${data.challengeId}, ${data.title.trim()}, ${data.description.trim()}, ${data.requirement.trim()}, ${start.toISOString()}, ${end.toISOString()}, ${data.sortOrder})
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        requirement = excluded.requirement,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        sort_order = excluded.sort_order
    `;
    return { ok: true as const, id };
  });

export const removeStage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const used = await sql`select 1 as one from challenge_submissions where stage_id = ${data.id} limit 1`;
    if (used.length) return { ok: false as const, error: "This stage already has looks. Leave it so those entries stay attached." };
    await sql`delete from challenge_stages where id = ${data.id}`;
    return { ok: true as const };
  });

const twistInput = z.object({
  id: z.string().max(80).optional(),
  challengeId: z.string().min(1).max(80),
  title: z.string().min(2).max(80),
  description: z.string().max(400),
  requirement: z.string().max(200),
  imageDataUrl: z.string().max(1_200_000).optional(),
  clearImage: z.boolean().optional(),
  startsAt: z.string().min(8).max(40),
  endsAt: z.string().min(8).max(40),
});

export const saveTwist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => twistInput.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    if (data.imageDataUrl && !/^data:image\/(jpeg|png|webp);base64,/.test(data.imageDataUrl)) {
      return { ok: false as const, error: "Use a JPG, PNG, or WebP image." };
    }
    const start = parseWhen(data.startsAt);
    const end = parseWhen(data.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { ok: false as const, error: "The twist end has to be after the start." };
    }
    const id = data.id || `tw_${crypto.randomUUID()}`;
    const replaceImage = Boolean(data.clearImage || data.imageDataUrl);
    const nextImage = data.clearImage ? "" : (data.imageDataUrl ?? "");
    await sql`
      insert into twist_drops (id, challenge_id, title, description, requirement, image_url, starts_at, ends_at)
      values (
        ${id}, ${data.challengeId}, ${data.title.trim()}, ${data.description.trim()}, ${data.requirement.trim()},
        ${nextImage}, ${start.toISOString()}, ${end.toISOString()}
      )
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        requirement = excluded.requirement,
        image_url = case when ${replaceImage} then ${nextImage} else twist_drops.image_url end,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at
    `;
    return { ok: true as const, id };
  });

export const removeTwist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    await sql`delete from twist_drops where id = ${data.id}`;
    return { ok: true as const };
  });

export const saveGenderOptions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({
      options: z.array(z.object({
        id: z.string().max(40).optional(),
        label: z.string().min(1).max(40),
        active: z.boolean(),
      })).max(20),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    let n = 0;
    const keep: string[] = [];
    for (const option of data.options) {
      n += 1;
      const id = option.id || `g_${crypto.randomUUID()}`;
      keep.push(id);
      await sql`
        insert into gender_options (id, label, sort_order, active)
        values (${id}, ${option.label.trim()}, ${n}, ${option.active})
        on conflict (id) do update set label = excluded.label, sort_order = excluded.sort_order, active = excluded.active
      `;
    }
    if (keep.length) {
      await sql.query(`delete from gender_options where id <> all($1::text[])`, [keep]);
    }
    return { ok: true as const };
  });

export const saveThemeMeta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z.object({
      themeKey: z.enum(["gloss", "haunted", "frost", "valentine"]),
      weeklyTheme: z.string().max(80),
      monthlyTheme: z.string().max(80),
      themeName: z.string().max(40),
      themeDescription: z.string().max(240),
      themeStarts: z.string().max(40),
      themeEnds: z.string().max(40),
      accentColor: z.string().max(20),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const allowed = await requireFounder(sql, context.userId);
    if (!allowed.ok) return allowed;
    const accent = /^#([0-9a-fA-F]{6})$/.test(data.accentColor.trim()) ? data.accentColor.trim() : "";
    const starts = data.themeStarts ? parseWhen(data.themeStarts) : null;
    const ends = data.themeEnds ? parseWhen(data.themeEnds) : null;
    await sql`
      update platform_settings set
        theme_key = ${data.themeKey},
        weekly_theme = ${data.weeklyTheme.trim()},
        monthly_theme = ${data.monthlyTheme.trim()},
        theme_name = ${data.themeName.trim() || data.themeKey},
        theme_description = ${data.themeDescription.trim()},
        theme_starts = ${starts && !Number.isNaN(starts.getTime()) ? starts.toISOString() : null},
        theme_ends = ${ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : null},
        accent_color = ${accent}
      where id = 'current'
    `;
    return { ok: true as const, accent };
  });
