-- Fictional demo community. These profiles are not login accounts.

insert into profiles (
  user_id, username, bio, avatar_url, impress_points, challenge_wins, top_placements,
  follower_base, following_base, created_at
) values
  ('demo_luna', 'lunavale', 'Porcelain, pearls, and a little venom.', '/media/avatars/luna.jpg', 100, 1, 1, 1840, 186, now() - interval '140 days'),
  ('demo_noir', 'noiratelier', 'Tailoring for people who never blink first.', '/media/avatars/noir.jpg', 75, 0, 1, 1260, 96, now() - interval '120 days'),
  ('demo_micah', 'micahline', 'Architecture you can wear.', '/media/avatars/micah.jpg', 50, 0, 1, 980, 140, now() - interval '100 days'),
  ('demo_sage', 'sagerunway', 'Quiet silk. Loud silhouette.', '/media/avatars/sage.jpg', 0, 0, 0, 1510, 88, now() - interval '40 days'),
  ('demo_velour', 'velourkit', 'Red, louder, then red again.', '/media/avatars/velour.jpg', 0, 0, 0, 640, 310, now() - interval '18 days'),
  ('demo_pixie', 'pixieframe', 'New here. Already overdressed.', '/media/avatars/pixie.jpg', 0, 0, 0, 120, 40, now() - interval '2 days')
on conflict (user_id) do nothing;

insert into challenges (
  id, title, description, image_url, theme, start_date, end_date,
  points_first, points_second, points_third
) values
  (
    'ch_porcelain',
    'Porcelain After Dark',
    'Gothic dollhouse glamour. Lace, pearls, and a stare that wins the room. One look. The votes decide.',
    '/media/banners/porcelain.jpg',
    'Dollhouse',
    now() - interval '4 days',
    now() + interval '5 days',
    100, 75, 50
  ),
  (
    'ch_neon',
    'After Hours Tailoring',
    'Sharp suits, liquid light, and collars that could cut glass. Evening wear with a pulse.',
    '/media/banners/neon.jpg',
    'Tailoring',
    now() - interval '6 days',
    now() + interval '12 days',
    100, 75, 50
  ),
  (
    'ch_velvet',
    'Velvet Archive',
    'Archive velvet, old-hollywood volume, modern nerve. This round has closed.',
    '/media/banners/velvet.jpg',
    'Archive',
    now() - interval '24 days',
    now() - interval '2 days',
    100, 75, 50
  )
on conflict (id) do nothing;

insert into posts (id, user_id, image_url, caption, challenge_id, created_at) values
  ('p_luna_archive', 'demo_luna', '/media/looks/luna-archive.jpg', 'Archive night, but the lace showed up instead.', 'ch_velvet', now() - interval '20 days'),
  ('p_noir_archive', 'demo_noir', '/media/looks/noir-archive.jpg', 'Black on black. The lapel is the whole argument.', 'ch_velvet', now() - interval '19 days'),
  ('p_micah_archive', 'demo_micah', '/media/looks/micah-archive.jpg', 'Volume, then silence.', 'ch_velvet', now() - interval '18 days'),
  ('p_sage_silk', 'demo_sage', '/media/looks/sage-silk.jpg', 'Quiet silk. Loud silhouette.', null, now() - interval '30 days'),
  ('p_luna_pearl', 'demo_luna', '/media/looks/luna-pearl.jpg', 'Pearls on for Porcelain After Dark.', 'ch_porcelain', now() - interval '3 days'),
  ('p_noir_neon', 'demo_noir', '/media/looks/noir-neon.jpg', 'The collar could cut glass.', 'ch_neon', now() - interval '4 days'),
  ('p_velour_red', 'demo_velour', '/media/looks/velour-red.jpg', 'Red, then red again.', 'ch_porcelain', now() - interval '2 days'),
  ('p_sage_night', 'demo_sage', '/media/looks/sage-night.jpg', 'A quieter kind of dollhouse.', 'ch_porcelain', now() - interval '1 day'),
  ('p_pixie_neon', 'demo_pixie', '/media/looks/pixie-neon.jpg', 'First week. Already overdressed.', 'ch_neon', now() - interval '20 hours')
on conflict (id) do nothing;

insert into follows (follower_id, following_id) values
  ('demo_pixie', 'demo_luna'),
  ('demo_pixie', 'demo_sage'),
  ('demo_pixie', 'demo_velour'),
  ('demo_velour', 'demo_luna'),
  ('demo_velour', 'demo_noir'),
  ('demo_sage', 'demo_micah'),
  ('demo_sage', 'demo_luna'),
  ('demo_noir', 'demo_sage'),
  ('demo_micah', 'demo_noir'),
  ('demo_micah', 'demo_luna'),
  ('demo_luna', 'demo_sage'),
  ('demo_luna', 'demo_noir')
on conflict do nothing;

insert into likes (user_id, post_id)
select 'fan_' || g, 'p_sage_silk' from generate_series(1, 64) g
on conflict do nothing;
insert into likes (user_id, post_id)
select 'fan_' || g, 'p_luna_archive' from generate_series(1, 51) g
on conflict do nothing;
insert into likes (user_id, post_id)
select 'fan_' || g, 'p_velour_red' from generate_series(1, 38) g
on conflict do nothing;
insert into likes (user_id, post_id)
select 'fan_' || g, 'p_noir_archive' from generate_series(1, 29) g
on conflict do nothing;
insert into likes (user_id, post_id)
select 'fan_' || g, 'p_pixie_neon' from generate_series(1, 22) g
on conflict do nothing;
insert into likes (user_id, post_id)
select 'fan_' || g, 'p_luna_pearl' from generate_series(1, 18) g
on conflict do nothing;
insert into likes (user_id, post_id)
select 'fan_' || g, 'p_noir_neon' from generate_series(1, 15) g
on conflict do nothing;
insert into likes (user_id, post_id)
select 'fan_' || g, 'p_micah_archive' from generate_series(1, 14) g
on conflict do nothing;
insert into likes (user_id, post_id)
select 'fan_' || g, 'p_sage_night' from generate_series(1, 11) g
on conflict do nothing;

insert into comments (id, post_id, user_id, body, created_at) values
  ('c1', 'p_luna_archive', 'demo_noir', 'The pearls are doing something illegal.', now() - interval '9 days'),
  ('c2', 'p_luna_archive', 'demo_velour', 'This is the whole competition.', now() - interval '8 days'),
  ('c3', 'p_velour_red', 'demo_luna', 'Red like you mean it.', now() - interval '1 day'),
  ('c4', 'p_velour_red', 'demo_sage', 'The coat has a pulse.', now() - interval '20 hours'),
  ('c5', 'p_sage_silk', 'demo_pixie', 'How is silk this quiet and this loud.', now() - interval '6 days'),
  ('c6', 'p_sage_silk', 'demo_micah', 'Studied. And it still feels alive.', now() - interval '5 days'),
  ('c7', 'p_pixie_neon', 'demo_noir', 'The shoulders are doing the talking.', now() - interval '12 hours'),
  ('c8', 'p_noir_neon', 'demo_micah', 'Cut clean. Leave the light on the collar.', now() - interval '2 days')
on conflict (id) do nothing;

insert into challenge_submissions (id, challenge_id, post_id, user_id, created_at) values
  ('s_vl', 'ch_velvet', 'p_luna_archive', 'demo_luna', now() - interval '20 days'),
  ('s_vn', 'ch_velvet', 'p_noir_archive', 'demo_noir', now() - interval '19 days'),
  ('s_vm', 'ch_velvet', 'p_micah_archive', 'demo_micah', now() - interval '18 days'),
  ('s_pl', 'ch_porcelain', 'p_luna_pearl', 'demo_luna', now() - interval '3 days'),
  ('s_pv', 'ch_porcelain', 'p_velour_red', 'demo_velour', now() - interval '2 days'),
  ('s_ps', 'ch_porcelain', 'p_sage_night', 'demo_sage', now() - interval '1 day'),
  ('s_nn', 'ch_neon', 'p_noir_neon', 'demo_noir', now() - interval '4 days'),
  ('s_np', 'ch_neon', 'p_pixie_neon', 'demo_pixie', now() - interval '20 hours')
on conflict (id) do nothing;

insert into votes (voter_id, submission_id)
select 'fan_' || g, 's_vl' from generate_series(1, 24) g
on conflict do nothing;
insert into votes (voter_id, submission_id)
select 'fan_' || g, 's_vn' from generate_series(1, 16) g
on conflict do nothing;
insert into votes (voter_id, submission_id)
select 'fan_' || g, 's_vm' from generate_series(1, 9) g
on conflict do nothing;
insert into votes (voter_id, submission_id)
select 'fan_' || g, 's_pv' from generate_series(1, 14) g
on conflict do nothing;
insert into votes (voter_id, submission_id)
select 'fan_' || g, 's_ps' from generate_series(1, 9) g
on conflict do nothing;
insert into votes (voter_id, submission_id)
select 'fan_' || g, 's_pl' from generate_series(1, 6) g
on conflict do nothing;
insert into votes (voter_id, submission_id)
select 'fan_' || g, 's_np' from generate_series(1, 11) g
on conflict do nothing;
insert into votes (voter_id, submission_id)
select 'fan_' || g, 's_nn' from generate_series(1, 7) g
on conflict do nothing;

insert into challenge_results (challenge_id, user_id, place, points) values
  ('ch_velvet', 'demo_luna', 1, 100),
  ('ch_velvet', 'demo_noir', 2, 75),
  ('ch_velvet', 'demo_micah', 3, 50)
on conflict (challenge_id, user_id) do nothing;
