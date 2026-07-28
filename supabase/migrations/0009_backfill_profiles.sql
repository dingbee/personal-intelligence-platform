-- The on_auth_user_created trigger (0001_init.sql) only provisions a
-- profiles row for auth.users created *after* it exists. Any account
-- created before the trigger was wired up on this project has no matching
-- profiles row, which would make profile display/edit silently no-op
-- (UPDATE on a non-existent row affects zero rows without erroring).
-- Backfill once, keyed by id so it's safe to run again.
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
