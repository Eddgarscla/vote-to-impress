import type { Sql } from "@/lib/db";

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function syncLevel(sql: Sql, userId: string) {
  await sql.query(
    `update profiles set level_key = coalesce((
      select level_key from level_thresholds t
      where t.min_points <= profiles.impress_points
      order by t.min_points desc
      limit 1
    ), 'new_face') where user_id = $1`,
    [userId],
  );
}

async function finalizeChallenge(sql: Sql, challengeId: string) {
  const meta = await sql<{
    points_first: number;
    points_second: number;
    points_third: number;
    participation_points: number;
    vote_points: number;
    season_id: string;
    kind: string;
  }>`
    select points_first, points_second, points_third, participation_points, vote_points, season_id, kind
    from challenges where id = ${challengeId}
  `;
  const challenge = meta[0];
  if (!challenge) return;
  const bands = await sql<{ place_from: number; place_to: number; points: number }>`
    select place_from, place_to, points
    from reward_bands
    where scope = ${`challenge:${challengeId}`}
    order by place_from asc
  `;
  const ranked = await sql<{ user_id: string; votes: number }>`
    with entries as (
      select s.user_id, min(s.created_at) as created_at
      from challenge_submissions s
      join profiles p on p.user_id = s.user_id
      where s.challenge_id = ${challengeId}
        and p.is_demo = false
      group by s.user_id
    ),
    valid_votes as (
      select s.user_id as candidate, coalesce(v.weight, 1) as weight
      from votes v
      join challenge_submissions s on s.id = v.submission_id
      join profiles voter on voter.user_id = v.voter_id
      where s.challenge_id = ${challengeId}
        and v.voter_id <> s.user_id
        and voter.is_demo = false
    )
    select e.user_id, coalesce(sum(v.weight), 0)::int as votes
    from entries e
    left join valid_votes v on v.candidate = e.user_id
    group by e.user_id, e.created_at
    order by coalesce(sum(v.weight), 0) desc, e.created_at asc
  `;
  const participationBand = bands.find((band) => asNum(band.place_from) === 0);
  const participation = participationBand ? asNum(participationBand.points) : asNum(challenge.participation_points);
  const kind = ["daily", "weekly", "monthly"].includes(String(challenge.kind)) ? String(challenge.kind) : "weekly";
  let place = 0;
  for (const entry of ranked) {
    place += 1;
    const ranged = bands.find((band) => asNum(band.place_from) > 0 && place >= asNum(band.place_from) && place <= asNum(band.place_to));
    const placement = ranged
      ? asNum(ranged.points)
      : bands.length
        ? 0
        : place === 1
          ? asNum(challenge.points_first)
          : place === 2
            ? asNum(challenge.points_second)
            : place === 3
              ? asNum(challenge.points_third)
              : 0;
    const award = participation + asNum(entry.votes) * asNum(challenge.vote_points) + placement;
    const inserted = await sql<{ user_id: string }>`
      insert into challenge_results (challenge_id, user_id, place, points)
      values (${challengeId}, ${entry.user_id}, ${place}, ${award})
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
    const seasonId = challenge.season_id || "";
    await sql`
      insert into point_events (id, user_id, source, challenge_id, season_id, points)
      values (${`pe_${challengeId}_${entry.user_id}`}, ${entry.user_id}, ${kind}, ${challengeId}, ${seasonId}, ${award})
      on conflict (user_id, source, challenge_id, season_id) do nothing
    `;
    await syncLevel(sql, entry.user_id);
  }
  await sql`update challenges set results_published = true where id = ${challengeId}`;
}

async function finalizeSeason(sql: Sql, seasonId: string) {
  const ranked = await sql<{ user_id: string; points: number; weekly_wins: number }>`
    select p.user_id,
      coalesce(sum(e.points), 0)::int as points,
      coalesce((
        select count(*)::int
        from challenge_results r
        join challenges c on c.id = r.challenge_id
        where c.season_id = ${seasonId} and r.user_id = p.user_id and r.place = 1
      ), 0) as weekly_wins
    from profiles p
    join point_events e on e.user_id = p.user_id and e.season_id = ${seasonId} and e.source in ('daily', 'weekly', 'monthly') and e.challenge_id <> ''
    where p.is_demo = false
    group by p.user_id
    order by coalesce(sum(e.points), 0) desc, 3 desc, p.user_id asc
  `;
  let place = 0;
  for (const entry of ranked) {
    place += 1;
    const bonus = place === 1 ? 500 : place === 2 ? 250 : place === 3 ? 120 : 0;
    const inserted = await sql<{ user_id: string }>`
      insert into season_results (season_id, user_id, place, points, weekly_wins)
      values (${seasonId}, ${entry.user_id}, ${place}, ${asNum(entry.points)}, ${asNum(entry.weekly_wins)})
      on conflict (season_id, user_id) do nothing
      returning user_id
    `;
    if (!inserted.length || bonus <= 0) continue;
    await sql`
      insert into point_events (id, user_id, source, challenge_id, season_id, points)
      values (${`pe_month_${seasonId}_${entry.user_id}`}, ${entry.user_id}, 'monthly', '', ${seasonId}, ${bonus})
      on conflict (user_id, source, challenge_id, season_id) do nothing
    `;
    await sql`
      update profiles
      set impress_points = impress_points + ${bonus},
          top_placements = top_placements + 1
      where user_id = ${entry.user_id}
    `;
    await syncLevel(sql, entry.user_id);
  }
  await sql`update seasons set results_published = true where id = ${seasonId}`;
}

export async function finalizeCompetitions(sql: Sql) {
  const due = await sql<{ id: string }>`
    select c.id
    from challenges c
    where c.is_demo = false
      and coalesce(c.cancelled, false) = false
      and c.results_published = false
      and coalesce(c.voting_close, c.end_date) <= now()
  `;
  for (const row of due) await finalizeChallenge(sql, row.id);
  const seasons = await sql<{ id: string }>`
    select id from seasons
    where results_published = false
      and ends_at <= now()
  `;
  for (const season of seasons) await finalizeSeason(sql, season.id);
}
