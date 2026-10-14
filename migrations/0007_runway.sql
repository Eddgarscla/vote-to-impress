-- Additive runway update. No deletes of users, profiles, posts, or images.
-- Existing one-entry-per-challenge rows stay; stage_id defaults to ''.

alter table profiles add column if not exists gender text not null default '';
alter table profiles add column if not exists show_gender boolean not null default false;

create table if not exists gender_options (
  id text primary key,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

insert into gender_options (id, label, sort_order) values
  ('g_woman', 'Woman', 1),
  ('g_man', 'Man', 2),
  ('g_nonbinary', 'Non-binary', 3),
  ('g_custom', 'Custom', 4),
  ('g_private', 'Prefer not to say', 5)
on conflict (id) do nothing;

alter table challenge_submissions add column if not exists stage_id text not null default '';

do $$
declare cname text;
begin
  select c.conname into cname
  from pg_constraint c
  where c.conrelid = 'challenge_submissions'::regclass
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) ilike '%challenge_id%'
    and pg_get_constraintdef(c.oid) ilike '%user_id%'
    and pg_get_constraintdef(c.oid) not ilike '%stage_id%';
  if cname is not null then
    execute format('alter table challenge_submissions drop constraint %I', cname);
  end if;
end $$;

create unique index if not exists submissions_user_stage_uidx
  on challenge_submissions (challenge_id, user_id, stage_id);

alter table votes add column if not exists weight integer not null default 1;

create table if not exists reward_bands (
  id text primary key,
  scope text not null,
  place_from integer not null,
  place_to integer not null,
  points integer not null,
  sort_order integer not null default 0
);

insert into reward_bands (id, scope, place_from, place_to, points, sort_order) values
  ('rb_daily_p', 'kind:daily', 0, 0, 5, 0),
  ('rb_daily_1', 'kind:daily', 1, 1, 100, 1),
  ('rb_daily_2', 'kind:daily', 2, 2, 80, 2),
  ('rb_daily_3', 'kind:daily', 3, 3, 60, 3),
  ('rb_daily_4', 'kind:daily', 4, 10, 40, 4),
  ('rb_daily_5', 'kind:daily', 11, 50, 20, 5),
  ('rb_weekly_p', 'kind:weekly', 0, 0, 25, 0),
  ('rb_weekly_1', 'kind:weekly', 1, 1, 400, 1),
  ('rb_weekly_2', 'kind:weekly', 2, 2, 180, 2),
  ('rb_weekly_3', 'kind:weekly', 3, 3, 90, 3),
  ('rb_weekly_4', 'kind:weekly', 4, 10, 40, 4),
  ('rb_monthly_p', 'kind:monthly', 0, 0, 40, 0),
  ('rb_monthly_1', 'kind:monthly', 1, 1, 600, 1),
  ('rb_monthly_2', 'kind:monthly', 2, 2, 300, 2),
  ('rb_monthly_3', 'kind:monthly', 3, 3, 150, 3),
  ('rb_monthly_4', 'kind:monthly', 4, 10, 80, 4)
on conflict (id) do nothing;

alter table platform_settings add column if not exists vote_max integer not null default 10;
alter table platform_settings add column if not exists vote_regen integer not null default 1;
alter table platform_settings add column if not exists vote_interval_minutes integer not null default 60;
alter table platform_settings add column if not exists allow_multi_vote boolean not null default false;
alter table platform_settings add column if not exists vote_expiry boolean not null default false;
alter table platform_settings add column if not exists bonus_votes boolean not null default false;
alter table platform_settings add column if not exists theme_name text not null default 'Halloween';
alter table platform_settings add column if not exists theme_description text not null default 'Fashion monster dolls. Spooky glamour, cute gothic, high-fashion competition.';
alter table platform_settings add column if not exists theme_starts timestamptz;
alter table platform_settings add column if not exists theme_ends timestamptz;
alter table platform_settings add column if not exists accent_color text not null default '';

create table if not exists vote_wallets (
  user_id text primary key references profiles (user_id) on delete cascade,
  balance integer not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists challenge_stages (
  id text primary key,
  challenge_id text not null references challenges (id) on delete cascade,
  title text not null,
  description text not null default '',
  requirement text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sort_order integer not null default 0
);

create table if not exists twist_drops (
  id text primary key,
  challenge_id text not null references challenges (id) on delete cascade,
  title text not null,
  description text not null default '',
  requirement text not null default '',
  image_url text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

create table if not exists app_themes (
  theme_key text primary key,
  name text not null,
  description text not null default '',
  preset text not null default 'custom'
);

insert into app_themes (theme_key, name, description, preset) values
  ('haunted', 'Halloween', 'Original fashion-monster doll world. Cute gothic glamour, not a licensed character set.', 'illustrated'),
  ('gloss', 'Gloss', 'The approved floor. Pink light, clean cards, no seasonal overlay.', 'illustrated'),
  ('frost', 'Frost', 'Cool glass and winter light.', 'illustrated'),
  ('valentine', 'Valentine', 'Warm rose light for a softer season.', 'illustrated')
on conflict (theme_key) do nothing;
