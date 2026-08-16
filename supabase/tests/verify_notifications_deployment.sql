-- Notification Foundation Phase 1 — production deployment verification.
--
-- Read-only. Not a migration, not a test that mutates anything — a single
-- script to run against the live database (Supabase SQL editor, or `psql`)
-- to answer the one question this repository cannot answer from a checkout
-- alone: has migration 0068_notifications.sql actually reached production,
-- and specifically, does the *deployed* `invite_to_workspace()` contain the
-- notification-emission logic, or is it still the pre-0068 version?
--
-- A stale RPC is functionally invisible from the client: `invite_to_workspace`
-- still succeeds either way (the notification insert is additive, not a
-- precondition for the membership write), so "the invitation worked" proves
-- nothing about whether this migration shipped. This script proves it
-- directly, without needing to invite anyone.
--
-- Run the whole thing; read the `status` column in each result set.

-- 1. Does the notifications table exist with the expected shape?
select
  'notifications table' as check_name,
  case
    when to_regclass('public.notifications') is null then 'MISSING — 0068 not applied'
    else 'EXISTS'
  end as status;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'notifications'
order by ordinal_position;
-- Expected exactly: id (uuid), recipient_user_id (uuid), type (text),
-- payload (jsonb), read_at (timestamp with time zone, nullable),
-- created_at (timestamp with time zone).

-- 2. Index present?
select
  'notifications_recipient_created_idx' as check_name,
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'notifications_recipient_created_idx'
  ) then 'EXISTS' else 'MISSING' end as status;

-- 3. RLS enabled + exactly the expected policy (select-own-only, no
--    insert/update/delete policy at all).
select
  'notifications RLS enabled' as check_name,
  case when relrowsecurity then 'ENABLED' else 'DISABLED — SECURITY GAP' end as status
from pg_class
where oid = 'public.notifications'::regclass;

select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'notifications';
-- Expected: exactly one row — policyname 'Users view their own
-- notifications', cmd = 'SELECT', qual = '(auth.uid() = recipient_user_id)',
-- with_check = null. Zero rows for INSERT/UPDATE/DELETE.

-- 4. Both RPCs exist.
select
  'mark_notification_read' as check_name,
  case when to_regprocedure('public.mark_notification_read(uuid)') is not null
    then 'EXISTS' else 'MISSING' end as status
union all
select
  'mark_all_notifications_read',
  case when to_regprocedure('public.mark_all_notifications_read()') is not null
    then 'EXISTS' else 'MISSING' end;

-- 5. THE critical check: does the deployed invite_to_workspace() actually
--    contain the notification-emission logic, or is it still pre-0068?
--    Same static-inspection technique billing_security_test.sql already
--    uses for the collaboration-entitlement check.
select
  'invite_to_workspace contains notification insert' as check_name,
  case
    when pg_get_functiondef('public.invite_to_workspace(uuid,text,workspace_member_role)'::regprocedure)
         like '%insert into public.notifications%'
      then 'CURRENT — 0068 deployed'
    else 'STALE — production is running a pre-0068 invite_to_workspace(); the migration has not reached this database. Apply 0068_notifications.sql through the normal migration process.'
  end as status;

-- Sanity: the entitlement gate introduced by 0046 must still be present
-- (0068 must not have accidentally regressed an earlier migration).
select
  'invite_to_workspace still has collaboration entitlement gate' as check_name,
  case
    when pg_get_functiondef('public.invite_to_workspace(uuid,text,workspace_member_role)'::regprocedure)
         like '%has_feature(auth.uid(), ''collaboration'')%'
      then 'PRESENT'
    else 'MISSING — REGRESSION'
  end as status;

-- 6. Direct data check (fill in a real recipient user_id to inspect their
-- own notifications; requires running as a role that can see all rows,
-- e.g. the Supabase SQL editor's service-role connection — RLS still
-- applies to any other client).
-- select * from public.notifications where recipient_user_id = '<user-id>' order by created_at desc;
