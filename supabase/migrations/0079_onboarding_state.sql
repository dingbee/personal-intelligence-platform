-- ARRIYIA — First-Login Welcome Experience: persistent onboarding marker.
--
-- Smallest appropriate mechanism, per the product brief: a single nullable
-- timestamp on the existing `profiles` row (account-level truth, so it
-- naturally survives refresh/logout-login/device changes — no new table,
-- no client-side/localStorage state). NULL means "show the welcome
-- experience"; a non-null value (set once, on completion OR an explicit
-- skip — this migration does not distinguish the two, matching the brief's
-- "persist the state" requirement without inventing a finer-grained model
-- nothing reads) means "already handled, never show it again."
--
-- No RLS/grant change needed: `profiles` already has a self-update policy
-- (used today by updateProfile()/updateDefaultChatProvider() in
-- src/modules/settings/api/profile.ts) that covers this new column exactly
-- like every other one on the row — Postgres RLS is row-scoped, not
-- column-scoped, so an existing "user can update their own profile row"
-- policy already permits writing this column.
--
-- Backfill is the other half of "do not incorrectly treat an established
-- user as new": every profiles row that exists BEFORE this migration runs
-- gets a non-null value immediately (coalesced to its own created_at, a
-- real, meaningful timestamp rather than "now" for every existing user
-- alike). Only a profiles row inserted AFTER this migration — i.e. by
-- handle_new_user() for a genuinely new signup — is created with this
-- column NULL by construction (a newly added column has no default and
-- handle_new_user()'s own INSERT, unchanged by this migration, never sets
-- it), which is exactly the "this is a brand-new account" signal the
-- welcome experience gates on.

alter table public.profiles add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed_at is null;
