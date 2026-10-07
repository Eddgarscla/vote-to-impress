-- VOTE TO IMPRESS domain schema.
-- Identity lives in Better Auth ("user"). profiles.user_id matches that id.
-- Demo profiles use their own ids and are not login accounts.

create table if not exists profiles (
  user_id text primary key,
  username text not null unique,
  bio text not null default '',
  avatar_url text,
  impress_points integer not null default 0,
  challenge_wins integer not null default 0,
  top_placements integer not null default 0,
  follower_base integer not null default 0,
  following_base integer not null default 0,
  created_at timestamptz not null default now(),
  constraint profiles_username_fmt check (username ~ '^[a-z0-9_]{3,20}$')
);

create table if not exists challenges (
  id text primary key,
  title text not null,
  description text not null,
  image_url text not null,
  theme text not null default '',
  start_date timestamptz not null,
  end_date timestamptz not null,
  points_first integer not null default 100,
  points_second integer not null default 75,
  points_third integer not null default 50
);

create table if not exists posts (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  image_url text not null,
  caption text not null default '',
  challenge_id text references challenges (id),
  created_at timestamptz not null default now()
);

create index if not exists posts_user_idx on posts (user_id, created_at desc);
create index if not exists posts_created_idx on posts (created_at desc);

create table if not exists follows (
  follower_id text not null references profiles (user_id) on delete cascade,
  following_id text not null references profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx on follows (following_id);

create table if not exists likes (
  user_id text not null,
  post_id text not null references posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists likes_post_idx on likes (post_id);

create table if not exists comments (
  id text primary key,
  post_id text not null references posts (id) on delete cascade,
  user_id text not null references profiles (user_id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on comments (post_id, created_at);

create table if not exists challenge_submissions (
  id text primary key,
  challenge_id text not null references challenges (id) on delete cascade,
  post_id text not null references posts (id) on delete cascade,
  user_id text not null references profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id),
  unique (challenge_id, post_id)
);

create index if not exists submissions_challenge_idx on challenge_submissions (challenge_id);

create table if not exists votes (
  voter_id text not null,
  submission_id text not null references challenge_submissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (voter_id, submission_id)
);

create index if not exists votes_submission_idx on votes (submission_id);

create table if not exists challenge_results (
  challenge_id text not null references challenges (id) on delete cascade,
  user_id text not null references profiles (user_id) on delete cascade,
  place integer not null,
  points integer not null default 0,
  primary key (challenge_id, user_id)
);
