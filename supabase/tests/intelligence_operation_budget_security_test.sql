-- ARRIYIA — Operation Budget Foundation security test (0061_intelligence_
-- operation_budgets.sql). This migration is purely additive: three new
-- plan_quotas rows (one per engine, real monthly-scoped usage counters,
-- distinct from the existing feature:* boolean entitlement keys) and two
-- new nullable columns on ai_requests (operation_id, operation_type).
-- No new table, no new RPC, no new RLS policy — every boundary tested
-- below is the EXISTING resolve_effective_quota_limit/consume_quota/
-- ai_requests machinery, exercised against the three new quota keys and
-- the two new columns, confirming this migration introduced no new gap.
--
-- Users reused from founding_pro_invitation_security_test.sql (same
-- vetted, safe-to-mutate-within-a-rollback set):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co)
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)

-- ---------------------------------------------------------------------
-- 1. A Free-plan user resolves a null effective limit for all three
--    operation quota keys — no plan_quotas row exists for 'free', so
--    resolve_effective_quota_limit (and therefore beginIntelligenceOperation's
--    checkQuota gate) denies before any AI call, exactly like 'ai_messages'
--    already does for an unconfigured key.
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

  if public.resolve_effective_quota_limit('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'data_intelligence_operations') is not null then
    raise exception 'OPERATION BUDGET TEST FAILED (1): a Free-plan user has a non-null data_intelligence_operations limit';
  end if;
  if public.resolve_effective_quota_limit('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'analysis_intelligence_operations') is not null then
    raise exception 'OPERATION BUDGET TEST FAILED (1): a Free-plan user has a non-null analysis_intelligence_operations limit';
  end if;
  if public.resolve_effective_quota_limit('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'research_intelligence_operations') is not null then
    raise exception 'OPERATION BUDGET TEST FAILED (1): a Free-plan user has a non-null research_intelligence_operations limit';
  end if;

  raise notice 'OPERATION BUDGET TEST (1) PASSED: a Free-plan user has no operation budget quota configured for any engine';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A Pro-plan user resolves the seeded 1000/month limit for all three
--    operation keys.
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

  if public.resolve_effective_quota_limit('249c4f9a-fe94-4174-af49-ca38d526caba', 'data_intelligence_operations') <> 1000 then
    raise exception 'OPERATION BUDGET TEST FAILED (2): a Pro-plan user does not resolve 1000 for data_intelligence_operations';
  end if;
  if public.resolve_effective_quota_limit('249c4f9a-fe94-4174-af49-ca38d526caba', 'analysis_intelligence_operations') <> 1000 then
    raise exception 'OPERATION BUDGET TEST FAILED (2): a Pro-plan user does not resolve 1000 for analysis_intelligence_operations';
  end if;
  if public.resolve_effective_quota_limit('249c4f9a-fe94-4174-af49-ca38d526caba', 'research_intelligence_operations') <> 1000 then
    raise exception 'OPERATION BUDGET TEST FAILED (2): a Pro-plan user does not resolve 1000 for research_intelligence_operations';
  end if;

  raise notice 'OPERATION BUDGET TEST (2) PASSED: a Pro-plan user resolves the seeded 1000/month limit for all three operation keys';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A Founding Pro-plan user resolves the same limit through the exact
--    same mechanism — no special-cased "Founding Pro operations" path.
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

  if public.resolve_effective_quota_limit('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'research_intelligence_operations') <> 1000 then
    raise exception 'OPERATION BUDGET TEST FAILED (3): a Founding Pro-plan user does not resolve 1000 for research_intelligence_operations';
  end if;

  raise notice 'OPERATION BUDGET TEST (3) PASSED: a Founding Pro-plan user resolves the same limit through the same mechanism as Pro';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. The three operation quota keys are distinct from each other and
--    from the existing feature:* entitlement keys — a Pro user's
--    data_intelligence_operations budget is never accidentally aliased
--    to their analysis/research budget or to the boolean feature gate.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_pro_plan uuid;
begin
  select id into v_pro_plan from public.plans where code = 'pro';

  if (
    select count(distinct quota_limit) from public.plan_quotas
    where plan_id = v_pro_plan
      and quota_key in ('data_intelligence_operations', 'analysis_intelligence_operations', 'research_intelligence_operations', 'feature:data_intelligence')
  ) < 2 then
    raise exception 'OPERATION BUDGET TEST FAILED (4): operation keys are not distinguishable from the boolean feature:data_intelligence key by value';
  end if;

  if (
    select count(*) from public.plan_quotas
    where plan_id = v_pro_plan
      and quota_key in ('data_intelligence_operations', 'analysis_intelligence_operations', 'research_intelligence_operations')
  ) < 3 then
    raise exception 'OPERATION BUDGET TEST FAILED (4): expected three distinct operation-budget rows for Pro, found fewer';
  end if;

  raise notice 'OPERATION BUDGET TEST (4) PASSED: the three operation keys are distinct rows, not aliases of each other or of feature:data_intelligence';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. consume_quota increments ONLY the calling user's own quota_usage
--    row for the key it was called with — never another user's row,
--    and never a different key. consume_quota resolves the caller via
--    auth.uid() server-side (ignoring any client-supplied user id), so
--    this is the real isolation boundary, not merely RLS on a select.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_pro_plan uuid;
  v_other_user_before bigint;
  v_other_user_after bigint;
  v_caller_usage bigint;
begin
  select id into v_pro_plan from public.plans where code = 'pro';

  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('249c4f9a-fe94-4174-af49-ca38d526caba', v_pro_plan, true);

  select coalesce(sum(usage_count), 0) into v_other_user_before
  from public.quota_usage
  where user_id = '9e733cfc-e6ae-45e6-8b14-dc64247a9cb2' and quota_key = 'data_intelligence_operations';

  perform public.consume_quota('data_intelligence_operations');

  select coalesce(sum(usage_count), 0) into v_other_user_after
  from public.quota_usage
  where user_id = '9e733cfc-e6ae-45e6-8b14-dc64247a9cb2' and quota_key = 'data_intelligence_operations';

  if v_other_user_after <> v_other_user_before then
    raise exception 'OPERATION BUDGET TEST FAILED (5): consume_quota incremented a DIFFERENT user''s usage row';
  end if;

  select coalesce(usage_count, 0) into v_caller_usage
  from public.quota_usage
  where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba' and quota_key = 'data_intelligence_operations'
    and period_start = date_trunc('month', now());

  if v_caller_usage <> 1 then
    raise exception 'OPERATION BUDGET TEST FAILED (5): calling user''s own usage did not increment to exactly 1 (got %)', v_caller_usage;
  end if;

  raise notice 'OPERATION BUDGET TEST (5) PASSED: consume_quota only ever increments the calling user''s own quota_usage row for the exact key passed';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. An unauthenticated (anon) caller cannot execute consume_quota or
--    resolve_effective_quota_limit at all — a client can never resolve
--    or consume an operation budget for a key it invents on the fly,
--    regardless of quota_key value, since these are function-level
--    grants (not per-key), unchanged by this migration.
-- ---------------------------------------------------------------------

begin;

do $$
begin
  if has_function_privilege('anon', 'public.consume_quota(text)', 'EXECUTE') then
    raise exception 'OPERATION BUDGET TEST FAILED (6): anon can execute consume_quota';
  end if;
  if has_function_privilege('anon', 'public.resolve_effective_quota_limit(uuid, text)', 'EXECUTE') then
    raise exception 'OPERATION BUDGET TEST FAILED (6): anon can execute resolve_effective_quota_limit';
  end if;

  raise notice 'OPERATION BUDGET TEST (6) PASSED: anon has no execute privilege on consume_quota or resolve_effective_quota_limit';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 7. An ordinary authenticated user cannot write plan_quotas directly
--    for any of the three new operation keys (no client write policy
--    on this table — same structural guarantee every other plan_quotas
--    row already has).
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
    update public.plan_quotas set quota_limit = 999999
      where plan_id = v_pro_plan and quota_key = 'research_intelligence_operations';
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'OPERATION BUDGET TEST FAILED (7): an authenticated user wrote plan_quotas directly for an operation key';
  end if;

  raise notice 'OPERATION BUDGET TEST (7) PASSED: plan_quotas has no client write path for the new operation keys either';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 8. ai_requests cross-user isolation still holds with the new
--    operation_id/operation_type columns populated — a second user can
--    never select another user's operation-tagged rows. No new RLS
--    policy was added by this migration; the existing "auth.uid() =
--    user_id" select policy already covers the new columns.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_row_id uuid;
  v_visible_to_owner integer;
begin
  insert into public.ai_requests (user_id, feature, provider, latency_ms, status, operation_id, operation_type)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'research-investigation-step', 'anthropic', 100, 'success', gen_random_uuid(), 'research_intelligence')
  returning id into v_row_id;

  select count(*) into v_visible_to_owner from public.ai_requests where id = v_row_id;
  if v_visible_to_owner <> 1 then
    raise exception 'OPERATION BUDGET TEST FAILED (8): the owner cannot see their own operation-tagged ai_requests row';
  end if;

  raise notice 'OPERATION BUDGET TEST (8a) inserted % as owner, now switching caller to verify cross-user denial', v_row_id;
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_visible_to_other integer;
begin
  select count(*) into v_visible_to_other
  from public.ai_requests
  where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba' and operation_type = 'research_intelligence';

  if v_visible_to_other <> 0 then
    raise exception 'OPERATION BUDGET TEST FAILED (8): a different authenticated user can see another user''s operation-tagged ai_requests rows';
  end if;

  raise notice 'OPERATION BUDGET TEST (8b) PASSED: a different authenticated user sees zero rows for another user''s operation_id/operation_type-tagged requests';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 9. An authenticated user cannot insert an ai_requests row impersonating
--    another user's user_id, even with operation_id/operation_type set —
--    the existing "auth.uid() = user_id" insert policy is unaffected by
--    the two new columns; an attacker cannot fabricate operation history
--    under someone else's identity.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into public.ai_requests (user_id, feature, provider, latency_ms, status, operation_id, operation_type)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'research-investigation-step', 'anthropic', 100, 'success', gen_random_uuid(), 'research_intelligence');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'OPERATION BUDGET TEST FAILED (9): an authenticated user inserted an ai_requests row impersonating another user''s id';
  end if;

  raise notice 'OPERATION BUDGET TEST (9) PASSED: a user cannot insert an operation-tagged ai_requests row under another user''s identity';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 10. The three seed inserts are idempotent (on conflict do nothing) —
--     re-running the migration's inserts never duplicates rows or errors.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_count_before integer;
  v_count_after integer;
begin
  select count(*) into v_count_before from public.plan_quotas
  where quota_key in ('data_intelligence_operations', 'analysis_intelligence_operations', 'research_intelligence_operations');

  insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
  select p.id, 'data_intelligence_operations', 1000, 'monthly' from public.plans p where p.code in ('pro', 'founding_pro')
  on conflict (plan_id, quota_key) do nothing;
  insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
  select p.id, 'analysis_intelligence_operations', 1000, 'monthly' from public.plans p where p.code in ('pro', 'founding_pro')
  on conflict (plan_id, quota_key) do nothing;
  insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
  select p.id, 'research_intelligence_operations', 1000, 'monthly' from public.plans p where p.code in ('pro', 'founding_pro')
  on conflict (plan_id, quota_key) do nothing;

  select count(*) into v_count_after from public.plan_quotas
  where quota_key in ('data_intelligence_operations', 'analysis_intelligence_operations', 'research_intelligence_operations');

  if v_count_after <> v_count_before then
    raise exception 'OPERATION BUDGET TEST FAILED (10): re-running the seed inserts changed row count (% -> %)', v_count_before, v_count_after;
  end if;

  raise notice 'OPERATION BUDGET TEST (10) PASSED: the three seed inserts are idempotent';
end;
$$;

rollback;
