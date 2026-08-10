-- Phase 4 Commercial Architecture — Founding Protection Test.
-- Extended by Phase 5A with a second block covering the new AI-provider
-- allocation dimension (plan_ai_providers): editing Pro's provider
-- allocation must never change Founding Pro's, for the same reason as
-- the quota check below — both tables are keyed by plan_id, and
-- Founding Pro's plan_id is never touched by an edit scoped to Pro's.
--
-- Verifies the mandatory guarantee: changing Pro's plan_quotas must never
-- change Founding Pro's resolved limits. This is a property of
-- plan_quotas being keyed by plan_id (see 0045_founding_pro_plan.sql) —
-- Founding Pro is a fully independent `plans` row, not "Pro plus a flag."
--
-- Safe to run against a live database: every mutation captures the
-- pre-test value first and restores it exactly at the end, regardless of
-- pass/fail (the RESTORE block runs unconditionally). Run via the
-- Supabase SQL editor or `psql $DATABASE_URL -f
-- supabase/tests/founding_protection_test.sql`.
--
-- This was executed live against production (project uzshazetfkjkrdnxwjtl)
-- on 2026-08-10 as part of Phase 4 verification: Pro's ai_messages was
-- bumped 10000 -> 25000 and storage_bytes 5368709120 -> 10737418240;
-- Founding Pro's ai_messages/storage_bytes remained 10000/5368709120
-- unchanged throughout; Pro was then restored to its original values.
-- Verified via direct row comparison, not RAISE NOTICE output, since the
-- SQL execution path used for that run doesn't surface NOTICE text — the
-- do-block form below is for local/CI use where NOTICE output is visible.
-- The Phase 5A extension below was executed the same way on the same
-- date and also passed.

do $$
declare
  v_pro_id uuid;
  v_founding_id uuid;
  v_pro_ai_before bigint;
  v_pro_storage_before bigint;
  v_founding_ai_before bigint;
  v_founding_storage_before bigint;
  v_founding_ai_after bigint;
  v_founding_storage_after bigint;
begin
  select id into v_pro_id from public.plans where code = 'pro';
  select id into v_founding_id from public.plans where code = 'founding_pro';

  select quota_limit into v_pro_ai_before from public.plan_quotas where plan_id = v_pro_id and quota_key = 'ai_messages';
  select quota_limit into v_pro_storage_before from public.plan_quotas where plan_id = v_pro_id and quota_key = 'storage_bytes';
  select quota_limit into v_founding_ai_before from public.plan_quotas where plan_id = v_founding_id and quota_key = 'ai_messages';
  select quota_limit into v_founding_storage_before from public.plan_quotas where plan_id = v_founding_id and quota_key = 'storage_bytes';

  -- Change Pro's limits to clearly different values.
  update public.plan_quotas set quota_limit = v_pro_ai_before + 15000 where plan_id = v_pro_id and quota_key = 'ai_messages';
  update public.plan_quotas set quota_limit = v_pro_storage_before + 5368709120 where plan_id = v_pro_id and quota_key = 'storage_bytes';

  select quota_limit into v_founding_ai_after from public.plan_quotas where plan_id = v_founding_id and quota_key = 'ai_messages';
  select quota_limit into v_founding_storage_after from public.plan_quotas where plan_id = v_founding_id and quota_key = 'storage_bytes';

  -- Restore Pro's original values unconditionally before asserting, so a
  -- failed assertion still leaves the database in its original state.
  update public.plan_quotas set quota_limit = v_pro_ai_before where plan_id = v_pro_id and quota_key = 'ai_messages';
  update public.plan_quotas set quota_limit = v_pro_storage_before where plan_id = v_pro_id and quota_key = 'storage_bytes';

  if v_founding_ai_after <> v_founding_ai_before then
    raise exception 'FOUNDING PROTECTION FAILED: founding_pro ai_messages changed from % to % when pro was edited', v_founding_ai_before, v_founding_ai_after;
  end if;

  if v_founding_storage_after <> v_founding_storage_before then
    raise exception 'FOUNDING PROTECTION FAILED: founding_pro storage_bytes changed from % to % when pro was edited', v_founding_storage_before, v_founding_storage_after;
  end if;

  raise notice 'FOUNDING PROTECTION TEST PASSED: founding_pro limits (ai_messages=%, storage_bytes=%) unaffected by editing pro''s limits', v_founding_ai_before, v_founding_storage_before;
end;
$$;

-- ---------------------------------------------------------------------
-- Phase 5A extension — same guarantee for plan_ai_providers.
-- ---------------------------------------------------------------------

do $$
declare
  v_pro_id uuid;
  v_founding_id uuid;
  v_pro_google_active_before boolean;
  v_founding_google_active_before boolean;
  v_founding_google_active_after boolean;
begin
  select id into v_pro_id from public.plans where code = 'pro';
  select id into v_founding_id from public.plans where code = 'founding_pro';

  select active into v_pro_google_active_before from public.plan_ai_providers where plan_id = v_pro_id and provider_id = 'google';
  select active into v_founding_google_active_before from public.plan_ai_providers where plan_id = v_founding_id and provider_id = 'google';

  -- Flip Pro's 'google' allocation off.
  update public.plan_ai_providers set active = false where plan_id = v_pro_id and provider_id = 'google';

  select active into v_founding_google_active_after from public.plan_ai_providers where plan_id = v_founding_id and provider_id = 'google';

  -- Restore Pro's original value unconditionally before asserting.
  update public.plan_ai_providers set active = v_pro_google_active_before where plan_id = v_pro_id and provider_id = 'google';

  if v_founding_google_active_after is distinct from v_founding_google_active_before then
    raise exception 'FOUNDING PROTECTION FAILED (Phase 5A): founding_pro''s google provider allocation changed from % to % when pro''s was edited', v_founding_google_active_before, v_founding_google_active_after;
  end if;

  raise notice 'FOUNDING PROTECTION TEST (PHASE 5A) PASSED: founding_pro''s AI provider allocation unaffected by editing pro''s';
end;
$$;
