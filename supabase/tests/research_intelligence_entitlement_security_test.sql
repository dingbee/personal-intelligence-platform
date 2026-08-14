-- ARRIYIA Professional Intelligence — Research Intelligence (P2) security test.
-- Same conventions as analysis_intelligence_entitlement_security_test.sql and
-- data_intelligence's own precedent: this migration adds no new table or
-- RPC — it seeds one plan_quotas row and relies entirely on
-- has_feature/resolve_effective_quota_limit's existing, already-tested
-- authorization logic. These tests confirm the *data* (which plans got
-- which value) resolves correctly and that the existing write boundary
-- still holds for this new key. Research Intelligence's own evidence
-- access reuses retrieveContext/retrieveNoteContext (document_chunks/notes
-- RLS, unchanged) and, when it delegates to Analysis Intelligence,
-- structured_datasets (unchanged) — see those tables' own security tests
-- for that boundary's coverage, not duplicated here. An unauthenticated
-- caller cannot reach any of this in the first place: has_feature/
-- resolve_effective_quota_limit both resolve through auth.uid(), which is
-- null for an anon session, so the RPC itself denies before any row is
-- read — test 5 below exercises the closest thing to that boundary this
-- migration can meaningfully test (an authenticated non-owner attempting
-- a direct write), since a true anon RPC call cannot be simulated inside
-- a SQL transaction the same way.
--
-- Users reused from founding_pro_invitation_security_test.sql (same
-- vetted, safe-to-mutate-within-a-rollback set):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co)
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)

-- ---------------------------------------------------------------------
-- 1. A Free-plan user has no Research Intelligence entitlement.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_free_plan uuid;
begin
  select id into v_free_plan from public.plans where code = 'free';

  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_free_plan, true);

  if public.has_feature('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'research_intelligence') then
    raise exception 'RESEARCH INTELLIGENCE TEST FAILED (1): a Free-plan user has Research Intelligence entitlement';
  end if;

  raise notice 'RESEARCH INTELLIGENCE TEST (1) PASSED: a Free-plan user has no Research Intelligence entitlement';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A Pro-plan user has Research Intelligence entitlement.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_pro_plan uuid;
begin
  select id into v_pro_plan from public.plans where code = 'pro';

  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('249c4f9a-fe94-4174-af49-ca38d526caba', v_pro_plan, true);

  if not public.has_feature('249c4f9a-fe94-4174-af49-ca38d526caba', 'research_intelligence') then
    raise exception 'RESEARCH INTELLIGENCE TEST FAILED (2): a Pro-plan user lacks Research Intelligence entitlement';
  end if;

  raise notice 'RESEARCH INTELLIGENCE TEST (2) PASSED: a Pro-plan user has Research Intelligence entitlement';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A Founding Pro-plan user has Research Intelligence entitlement
--    through the exact same feature key, resolved through the exact
--    same active user_plan_assignments row every other plan resolution
--    reads — no separate "Founding Pro research" code path exists.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';

do $$
declare
  v_founding_pro_plan uuid;
begin
  select id into v_founding_pro_plan from public.plans where code = 'founding_pro';

  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '9e733cfc-e6ae-45e6-8b14-dc64247a9cb2' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', v_founding_pro_plan, true);

  if not public.has_feature('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'research_intelligence') then
    raise exception 'RESEARCH INTELLIGENCE TEST FAILED (3): a Founding Pro-plan user lacks Research Intelligence entitlement';
  end if;

  raise notice 'RESEARCH INTELLIGENCE TEST (3) PASSED: a Founding Pro-plan user has Research Intelligence entitlement, same key as Pro';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Research Intelligence is gated on a key DISTINCT from
--    analysis_intelligence, data_intelligence, and pro_intelligence — a
--    Pro user's entitlement to one does not depend on a different key
--    accidentally aliasing it.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_pro_plan uuid;
begin
  select id into v_pro_plan from public.plans where code = 'pro';

  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('249c4f9a-fe94-4174-af49-ca38d526caba', v_pro_plan, true);

  if not exists (
    select 1 from public.plan_quotas
    where plan_id = v_pro_plan and quota_key = 'feature:research_intelligence' and quota_limit = 1
  ) then
    raise exception 'RESEARCH INTELLIGENCE TEST FAILED (4): plan_quotas has no distinct feature:research_intelligence row for Pro';
  end if;

  if (
    select count(*) from public.plan_quotas
    where plan_id = v_pro_plan and quota_key in ('feature:research_intelligence', 'feature:analysis_intelligence', 'feature:data_intelligence', 'feature:pro_intelligence')
  ) < 4 then
    raise exception 'RESEARCH INTELLIGENCE TEST FAILED (4): expected four distinct feature rows for Pro (pro/data/analysis/research intelligence), found fewer';
  end if;

  raise notice 'RESEARCH INTELLIGENCE TEST (4) PASSED: research_intelligence is a distinct key, not an alias of the other three';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. An ordinary authenticated user cannot write plan_quotas directly
--    (no client write policy on this table — same structural guarantee
--    every other plan_quotas row already has, unchanged by this phase).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_pro_plan uuid;
  v_failed boolean := false;
begin
  select id into v_pro_plan from public.plans where code = 'pro';

  begin
    update public.plan_quotas set quota_limit = 0
      where plan_id = v_pro_plan and quota_key = 'feature:research_intelligence';
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'RESEARCH INTELLIGENCE TEST FAILED (5): an authenticated user wrote plan_quotas directly';
  end if;

  raise notice 'RESEARCH INTELLIGENCE TEST (5) PASSED: plan_quotas has no client write path, even for the founder';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. The seed migration's insert is idempotent (on conflict do nothing)
--    — re-running it never duplicates or errors.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_count_before integer;
  v_count_after integer;
begin
  select count(*) into v_count_before from public.plan_quotas where quota_key = 'feature:research_intelligence';

  insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
  select p.id, 'feature:research_intelligence', 1, 'monthly'
  from public.plans p
  where p.code in ('pro', 'founding_pro')
  on conflict (plan_id, quota_key) do nothing;

  select count(*) into v_count_after from public.plan_quotas where quota_key = 'feature:research_intelligence';

  if v_count_after <> v_count_before then
    raise exception 'RESEARCH INTELLIGENCE TEST FAILED (6): re-running the seed insert changed row count (% -> %)', v_count_before, v_count_after;
  end if;

  raise notice 'RESEARCH INTELLIGENCE TEST (6) PASSED: the seed insert is idempotent';
end;
$$;

rollback;
