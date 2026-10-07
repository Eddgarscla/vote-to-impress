-- Additive platform update. Does not delete profiles, posts, or images.

alter table profiles add column if not exists display_name text not null default '';
alter table profiles add column if not exists pronouns text not null default '';
alter table profiles add column if not exists location text not null default '';
alter table profiles add column if not exists website text not null default '';
alter table profiles add column if not exists instagram text not null default '';
alter table profiles add column if not exists tiktok text not null default '';
alter table profiles add column if not exists x_handle text not null default '';
alter table profiles add column if not exists roblox_username text not null default '';
alter table profiles add column if not exists roblox_url text not null default '';
alter table profiles add column if not exists show_personal boolean not null default true;
alter table profiles add column if not exists verified boolean not null default false;
alter table profiles add column if not exists is_test boolean not null default false;

alter table challenges add column if not exists kind text not null default 'weekly';
alter table challenges add column if not exists active boolean not null default true;
alter table challenges add column if not exists cancelled boolean not null default false;

create table if not exists post_images (
  post_id text not null references posts (id) on delete cascade,
  position integer not null,
  image_url text not null,
  primary key (post_id, position)
);

insert into post_images (post_id, position, image_url)
select id, 0, image_url from posts
on conflict (post_id, position) do nothing;

create table if not exists verification_requests (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  message text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id text
);

create index if not exists verification_user_idx on verification_requests (user_id, created_at desc);

create table if not exists level_thresholds (
  level_key text primary key,
  label text not null,
  min_points integer not null,
  sort_order integer not null
);

insert into level_thresholds (level_key, label, min_points, sort_order) values
  ('new_face', 'New Face', 0, 1),
  ('rising_star', 'Rising Star', 100, 2),
  ('fashion_icon', 'Fashion Icon', 350, 3),
  ('style_royalty', 'Style Royalty', 800, 4),
  ('superstar', 'Superstar', 1600, 5),
  ('legend', 'Legend', 3000, 6)
on conflict (level_key) do nothing;

create table if not exists platform_settings (
  id text primary key,
  theme_key text not null default 'haunted',
  weekly_theme text not null default '',
  monthly_theme text not null default ''
);

insert into platform_settings (id, theme_key, weekly_theme, monthly_theme)
values ('current', 'haunted', 'Moonlight couture', 'Haunted fashion season')
on conflict (id) do nothing;

insert into challenges (
  id, title, description, image_url, theme, start_date, end_date,
  points_first, points_second, points_third,
  is_demo, season_id, submissions_close, voting_close, vote_budget,
  participation_points, vote_points, results_published, kind, active, cancelled
) values (
  'ch_october_month',
  'October Runway',
  'The monthly board. Weekly wins help, but the month is scored on its own submissions and votes.',
  '/media/brand/haunted.jpg',
  'Haunted fashion',
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month',
  600, 300, 150,
  false,
  'season_october',
  date_trunc('month', now()) + interval '24 days',
  date_trunc('month', now()) + interval '1 month',
  10, 40, 8, false, 'monthly', true, false
)
on conflict (id) do nothing;

insert into profiles (
  user_id, username, display_name, bio, avatar_url, impress_points, level_key,
  follower_base, following_base, is_demo, is_test, verified, role, roblox_username, created_at
) values
  ('test_mira', 'miraquill', 'Mira Quill', 'Test account. Velvet notes and a pending verification.', '/media/avatars/luna.jpg', 140, 'rising_star', 32, 18, false, true, false, 'member', 'MiraQuill', now() - interval '12 days'),
  ('test_juniper', 'juniperlane', 'Juniper Lane', 'Test account. Already verified so the badge can be reviewed.', '/media/avatars/sage.jpg', 420, 'fashion_icon', 88, 40, false, true, true, 'member', '', now() - interval '20 days'),
  ('test_cass', 'cassvelvet', 'Cass Velvet', 'Test account. Here for votes, follows, and the monthly board.', '/media/avatars/noir.jpg', 60, 'new_face', 14, 22, false, true, false, 'member', 'CassVelvet', now() - interval '6 days'),
  ('test_orio', 'orioframe', 'Orio Frame', 'Test account. Multi-photo looks, no founder access.', '/media/avatars/micah.jpg', 210, 'rising_star', 41, 15, false, true, false, 'member', '', now() - interval '9 days')
on conflict (user_id) do nothing;

insert into posts (id, user_id, image_url, caption, challenge_id, created_at, is_demo) values
  ('p_mira_set', 'test_mira', '/media/looks/luna-pearl.jpg', 'Test look. Two frames, one post.', 'ch_haunted_week', now() - interval '2 days', false),
  ('p_juniper_night', 'test_juniper', '/media/looks/sage-night.jpg', 'Test look for the weekly board.', 'ch_haunted_week', now() - interval '1 day', false),
  ('p_cass_month', 'test_cass', '/media/looks/noir-neon.jpg', 'Test look for the monthly board.', 'ch_october_month', now() - interval '8 hours', false),
  ('p_orio_set', 'test_orio', '/media/looks/micah-archive.jpg', 'Test gallery. Three photos, one post.', null, now() - interval '3 hours', false)
on conflict (id) do nothing;

insert into post_images (post_id, position, image_url) values
  ('p_mira_set', 0, '/media/looks/luna-pearl.jpg'),
  ('p_mira_set', 1, '/media/looks/sage-silk.jpg'),
  ('p_juniper_night', 0, '/media/looks/sage-night.jpg'),
  ('p_cass_month', 0, '/media/looks/noir-neon.jpg'),
  ('p_orio_set', 0, '/media/looks/micah-archive.jpg'),
  ('p_orio_set', 1, '/media/looks/velour-red.jpg'),
  ('p_orio_set', 2, '/media/banners/neon.jpg')
on conflict (post_id, position) do nothing;

insert into challenge_submissions (id, challenge_id, post_id, user_id) values
  ('s_mira_week', 'ch_haunted_week', 'p_mira_set', 'test_mira'),
  ('s_juniper_week', 'ch_haunted_week', 'p_juniper_night', 'test_juniper'),
  ('s_cass_month', 'ch_october_month', 'p_cass_month', 'test_cass'),
  ('s_mira_month', 'ch_october_month', 'p_mira_set', 'test_mira')
on conflict do nothing;

insert into votes (voter_id, submission_id) values
  ('test_cass', 's_mira_week'),
  ('test_orio', 's_juniper_week'),
  ('test_juniper', 's_mira_week'),
  ('test_orio', 's_cass_month')
on conflict do nothing;

insert into follows (follower_id, following_id) values
  ('test_mira', 'test_juniper'),
  ('test_cass', 'test_mira'),
  ('test_orio', 'test_cass'),
  ('test_juniper', 'test_orio')
on conflict do nothing;

insert into verification_requests (id, user_id, message, status)
values (
  'vr_mira',
  'test_mira',
  'Test request. Please review this account before approving a badge.',
  'pending'
)
on conflict (id) do nothing;
