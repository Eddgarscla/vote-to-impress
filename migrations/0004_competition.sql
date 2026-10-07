-- Competition seasons, hidden results, Impress levels, and a studio/demo split.
-- Existing tables stay. Demo rows are labeled so they are not real players.

alter table profiles add column if not exists role text not null default 'member';
alter table profiles add column if not exists is_demo boolean not null default false;
alter table profiles add column if not exists level_key text not null default 'new_face';

alter table posts add column if not exists is_demo boolean not null default false;

alter table challenges add column if not exists is_demo boolean not null default false;
alter table challenges add column if not exists season_id text not null default '';
alter table challenges add column if not exists submissions_close timestamptz;
alter table challenges add column if not exists voting_close timestamptz;
alter table challenges add column if not exists vote_budget integer not null default 10;
alter table challenges add column if not exists participation_points integer not null default 25;
alter table challenges add column if not exists vote_points integer not null default 5;
alter table challenges add column if not exists results_published boolean not null default false;

update profiles set is_demo = true where user_id like 'demo_%';
update posts set is_demo = true where user_id like 'demo_%';
update challenges
set is_demo = true,
    results_published = true,
    submissions_close = coalesce(submissions_close, end_date),
    voting_close = coalesce(voting_close, end_date)
where id in ('ch_porcelain', 'ch_neon', 'ch_velvet');

create table if not exists seasons (
  id text primary key,
  title text not null,
  tagline text not null default '',
  theme_key text not null default 'gloss',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  results_published boolean not null default false
);

create table if not exists season_results (
  season_id text not null references seasons (id) on delete cascade,
  user_id text not null references profiles (user_id) on delete cascade,
  place integer not null,
  points integer not null,
  weekly_wins integer not null default 0,
  primary key (season_id, user_id)
);

create table if not exists point_events (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  source text not null,
  challenge_id text not null default '',
  season_id text not null default '',
  points integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, source, challenge_id, season_id)
);

insert into seasons (id, title, tagline, theme_key, starts_at, ends_at)
values (
  'season_october',
  'October — Haunted Fashion Season',
  'A month of dark glam. Weekly rounds add up. One lucky week does not crown the month.',
  'haunted',
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month'
)
on conflict (id) do nothing;

insert into challenges (
  id, title, description, image_url, theme, start_date, end_date,
  points_first, points_second, points_third,
  is_demo, season_id, submissions_close, voting_close, vote_budget,
  participation_points, vote_points, results_published
) values (
  'ch_haunted_week',
  'Moonlight Couture',
  'One look for the haunted runway. Likes are just likes. Competitive votes are limited, secret until the round closes, and followers do not count.',
  '/media/brand/haunted.jpg',
  'Haunted glam',
  now() - interval '1 hour',
  now() + interval '7 days',
  400, 180, 90,
  false,
  'season_october',
  now() + interval '5 days',
  now() + interval '7 days',
  10,
  25,
  5,
  false
)
on conflict (id) do nothing;
