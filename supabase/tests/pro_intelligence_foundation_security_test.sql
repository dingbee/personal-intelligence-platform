-- ARRIYIA Professional Intelligence — Phase P0: Pro Intelligence
-- Foundation security test. Same conventions as the Founding Pro Phase
-- test files: each numbered block is a self-contained `begin; ...
-- rollback;` transaction (mutating blocks only), `request.jwt.claims`
-- simulates a real authenticated session (no role switch). This
-- migration adds no new table/RPC — it seeds plan_quotas rows and
-- relies entirely on has_feature/resolve_effective_quota_limit's
-- existing, already-tested authorization logic, so these tests exist to
-- confirm the *data* (which plans got which value) resolves correctly
-- and that the existing write boundary still holds for this new key —
-- not to re-test resolve_effective_quota_limit's own auth check from
-- scratch.
--
-- Users reused from founding_pro_invitation_security_test.sql (same
-- vetted, safe-to-mutate-within-a-rollback set; see that file's header
-- for why real auth.users ids are used purely as valid FK targets):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co)
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)
--
-- Deliberately does NOT reuse 5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1
-- (engutoto@gmail.com) — that user has a real, live pending Founding Pro
-- application and must never be touched, even inside a rolled-back
-- transaction.

-- ---------------------------------------------------------------------
-- 1. A Free-plan user has no Pro Intelligence entitlement.
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

  if public.has_feature('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'pro_intelligence') then
    raise exception 'PRO INTELLIGENCE TEST FAILED (1): a Free-plan user has Pro Intelligence entitlement';
  end if;

  raise notice 'PRO INTELLIGENCE TEST (1) PASSED: a Free-plan user has no Pro Intelligence entitlement';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A Pro-plan user has Pro Intelligence entitlement.
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

  if not public.has_feature('249c4f9a-fe94-4174-af49-ca38d526caba', 'pro_intelligence') then
    raise exception 'PRO INTELLIGENCE TEST FAILED (2): a Pro-plan user lacks Pro Intelligence entitlement';
  end if;

  raise notice 'PRO INTELLIGENCE TEST (2) PASSED: a Pro-plan user has Pro Intelligence entitlement';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A Founding Pro-plan user has Pro Intelligence entitlement through
--    the exact same feature key, resolved through the exact same
--    active user_plan_assignments row every other plan resolution
--    reads — no separate "Founding Pro intelligence" check exists.
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

  if not public.has_feature('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'pro_intelligence') then
    raise exception 'PRO INTELLIGENCE TEST FAILED (3): a Founding Pro-plan user lacks Pro Intelligence entitlement';
  end if;

  raise notice 'PRO INTELLIGENCE TEST (3) PASSED: a Founding Pro-plan user has Pro Intelligence entitlement, same key as Pro';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. An ordinary authenticated user cannot resolve Pro Intelligence
--    entitlement for a *different* user (resolve_effective_quota_limit's
--    pre-existing self-or-admin check, re-verified for this new key —
--    "unauthorized/direct access" boundary).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.has_feature('249c4f9a-fe94-4174-af49-ca38d526caba', 'pro_intelligence');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'PRO INTELLIGENCE TEST FAILED (4): a non-admin resolved another user''s entitlement';
  end if;

  raise notice 'PRO INTELLIGENCE TEST (4) PASSED: a non-admin cannot resolve another user''s Pro Intelligence entitlement';
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
      where plan_id = v_pro_plan and quota_key = 'feature:pro_intelligence';
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'PRO INTELLIGENCE TEST FAILED (5): an authenticated user wrote plan_quotas directly';
  end if;

  raise notice 'PRO INTELLIGENCE TEST (5) PASSED: plan_quotas has no client write path, even for the founder';
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
  select count(*) into v_count_before from public.plan_quotas where quota_key = 'feature:pro_intelligence';

  insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
  select p.id, 'feature:pro_intelligence', 1, 'monthly'
  from public.plans p
  where p.code in ('pro', 'founding_pro')
  on conflict (plan_id, quota_key) do nothing;

  select count(*) into v_count_after from public.plan_quotas where quota_key = 'feature:pro_intelligence';

  if v_count_after <> v_count_before then
    raise exception 'PRO INTELLIGENCE TEST FAILED (6): re-running the seed insert changed row count (% -> %)', v_count_before, v_count_after;
  end if;

  raise notice 'PRO INTELLIGENCE TEST (6) PASSED: the seed insert is idempotent';
end;
$$;

rollback;
