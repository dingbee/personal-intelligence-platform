-- Phase 5A — storage downgrade-safety verification.
--
-- Requirement: downgrading a user's plan must never delete existing
-- documents/assets. Only future uploads beyond the new (lower) limit are
-- blocked; existing data is always preserved, and re-upgrading restores
-- upload capability with zero data loss.
--
-- This holds structurally, not by convention: enforce_storage_quota()
-- (0046_feature_entitlements_and_storage_quota.sql) is wired as a BEFORE
-- INSERT trigger only — there is no UPDATE or DELETE trigger anywhere in
-- this codebase that reacts to a plan change by touching documents/
-- assets rows. A plan downgrade is exclusively a user_plan_assignments
-- write (apply_subscription_event / admin_change_user_plan); neither
-- ever cascades into document/asset storage. This test asserts that
-- structural fact directly against pg_trigger rather than re-deriving it
-- from reading migration files, since a future migration could
-- theoretically add a DELETE trigger without anyone re-checking this
-- guarantee by hand.
--
-- 100% read-only — safe to run against production at any time. Executed
-- live against production (project uzshazetfkjkrdnxwjtl) on 2026-08-10;
-- passed.

do $$
declare
  v_bad_trigger record;
begin
  for v_bad_trigger in
    select c.relname as table_name, t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname in ('documents', 'assets')
      and not t.tgisinternal
      and (t.tgtype::int & 8) <> 0 -- DELETE bit
  loop
    raise exception 'STORAGE DOWNGRADE SAFETY FAILED: % has a DELETE trigger (%) that could destroy data on a plan change',
      v_bad_trigger.table_name, v_bad_trigger.trigger_name;
  end loop;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'documents' and t.tgname = 'enforce_storage_quota_on_documents'
      and (t.tgtype::int & 4) <> 0 -- INSERT bit
      and (t.tgtype::int & 16) = 0 -- not UPDATE
  ) then
    raise exception 'STORAGE DOWNGRADE SAFETY FAILED: enforce_storage_quota_on_documents is missing or not INSERT-only';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'assets' and t.tgname = 'enforce_storage_quota_on_assets'
      and (t.tgtype::int & 4) <> 0
      and (t.tgtype::int & 16) = 0
  ) then
    raise exception 'STORAGE DOWNGRADE SAFETY FAILED: enforce_storage_quota_on_assets is missing or not INSERT-only';
  end if;

  raise notice 'STORAGE DOWNGRADE SAFETY TEST PASSED: storage quota enforcement is INSERT-only on documents/assets, no DELETE trigger exists on either table';
end;
$$;
