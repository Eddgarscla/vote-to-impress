-- Login rows for the existing fictional test profiles.
-- Does not insert profiles, posts, or images, and never grants Founder.

insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
select 'test_mira', 'Mira Quill', 'miraquill@test.votetoimpress.app', true, now(), now()
where not exists (
  select 1 from "user" where "id" = 'test_mira' or lower("email") = 'miraquill@test.votetoimpress.app'
);

insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
select 'test_juniper', 'Juniper Lane', 'juniperlane@test.votetoimpress.app', true, now(), now()
where not exists (
  select 1 from "user" where "id" = 'test_juniper' or lower("email") = 'juniperlane@test.votetoimpress.app'
);

insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
select 'test_cass', 'Cass Velvet', 'cassvelvet@test.votetoimpress.app', true, now(), now()
where not exists (
  select 1 from "user" where "id" = 'test_cass' or lower("email") = 'cassvelvet@test.votetoimpress.app'
);

insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
select 'test_orio', 'Orio Frame', 'orioframe@test.votetoimpress.app', true, now(), now()
where not exists (
  select 1 from "user" where "id" = 'test_orio' or lower("email") = 'orioframe@test.votetoimpress.app'
);

-- Shared password: RunwayTest1
-- Hash produced by Better Auth's scrypt password hasher.
insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
select 'acc_test_mira', 'test_mira', 'credential', 'test_mira',
  'b2366c1bdfe27afb34d252f0f53e7bc3:80071f635051ff6644d1225abbcabd58bd160581036f1c4151341382d6323ac2abcc37911b112356a2662cb57ec678acf1772957a6a831961ba4d2dfc71cef0b',
  now(), now()
where exists (select 1 from "user" where "id" = 'test_mira')
  and not exists (select 1 from "account" where "userId" = 'test_mira' and "providerId" = 'credential');

insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
select 'acc_test_juniper', 'test_juniper', 'credential', 'test_juniper',
  'b2366c1bdfe27afb34d252f0f53e7bc3:80071f635051ff6644d1225abbcabd58bd160581036f1c4151341382d6323ac2abcc37911b112356a2662cb57ec678acf1772957a6a831961ba4d2dfc71cef0b',
  now(), now()
where exists (select 1 from "user" where "id" = 'test_juniper')
  and not exists (select 1 from "account" where "userId" = 'test_juniper' and "providerId" = 'credential');

insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
select 'acc_test_cass', 'test_cass', 'credential', 'test_cass',
  'b2366c1bdfe27afb34d252f0f53e7bc3:80071f635051ff6644d1225abbcabd58bd160581036f1c4151341382d6323ac2abcc37911b112356a2662cb57ec678acf1772957a6a831961ba4d2dfc71cef0b',
  now(), now()
where exists (select 1 from "user" where "id" = 'test_cass')
  and not exists (select 1 from "account" where "userId" = 'test_cass' and "providerId" = 'credential');

insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
select 'acc_test_orio', 'test_orio', 'credential', 'test_orio',
  'b2366c1bdfe27afb34d252f0f53e7bc3:80071f635051ff6644d1225abbcabd58bd160581036f1c4151341382d6323ac2abcc37911b112356a2662cb57ec678acf1772957a6a831961ba4d2dfc71cef0b',
  now(), now()
where exists (select 1 from "user" where "id" = 'test_orio')
  and not exists (select 1 from "account" where "userId" = 'test_orio' and "providerId" = 'credential');

update profiles
set role = 'member', is_test = true
where user_id in ('test_mira', 'test_juniper', 'test_cass', 'test_orio');
