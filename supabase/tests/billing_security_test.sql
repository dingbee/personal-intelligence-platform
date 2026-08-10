-- Phase 4 Commercial Architecture — read-only security grant verification.
--
-- These assertions are the structural (grant-level) answer to "an
-- authenticated user cannot self-upgrade" and "anon cannot self-upgrade":
-- apply_subscription_event is the sole write path for subscription state
-- and the entitlement it grants, and its EXECUTE grant is checked here
-- directly rather than inferred from reading the migration — a grant is
-- live database state, not application code, so it can drift from what a
-- migration file says unless it's actually queried.
--
-- 100% read-only (has_function_privilege performs no writes) — safe to
-- run against production at any time. Executed live against production
-- (project uzshazetfkjkrdnxwjtl) on 2026-08-10 as part of Phase 4
-- verification; all assertions passed.
--
-- Run via the Supabase SQL editor or `psql $DATABASE_URL -f
-- supabase/tests/billing_security_test.sql`.

do $$
declare
  v_apply_event_sig text := 'public.apply_subscription_event(text,text,text,uuid,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,jsonb)';
begin
  if has_function_privilege('anon', v_apply_event_sig, 'EXECUTE') then
    raise exception 'SECURITY FAILED: anon can execute apply_subscription_event (self-upgrade would be possible)';
  end if;

  if has_function_privilege('authenticated', v_apply_event_sig, 'EXECUTE') then
    raise exception 'SECURITY FAILED: authenticated can execute apply_subscription_event (self-upgrade would be possible)';
  end if;

  if not has_function_privilege('service_role', v_apply_event_sig, 'EXECUTE') then
    raise exception 'CONFIGURATION FAILED: service_role cannot execute apply_subscription_event (the billing webhook would be unable to apply any subscription event)';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'enforce_storage_quota_on_documents' and tgenabled <> 'D'
  ) then
    raise exception 'SECURITY FAILED: enforce_storage_quota_on_documents trigger is missing or disabled';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'enforce_storage_quota_on_assets' and tgenabled <> 'D'
  ) then
    raise exception 'SECURITY FAILED: enforce_storage_quota_on_assets trigger is missing or disabled';
  end if;

  if pg_get_functiondef('public.invite_to_workspace(uuid,text,workspace_member_role)'::regprocedure)
     not like '%has_feature(auth.uid(), ''collaboration'')%' then
    raise exception 'SECURITY FAILED: invite_to_workspace no longer contains the collaboration entitlement check';
  end if;

  raise notice 'BILLING SECURITY TEST PASSED: apply_subscription_event is service_role-only, storage quota triggers are enabled, collaboration gate is present';
end;
$$;
