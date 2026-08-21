-- ARRIYIA Commercial Readiness — feature:* boolean-flag repair security
-- test (0075_feature_flag_boolean_repair.sql).
--
-- Confirms the live-data bug (seven feature:* rows on pro/founding_pro
-- holding their sibling *_operations quota number instead of 1, causing
-- has_feature() to return false and ai-chat/index.ts's resolveQuotaKey to
-- hard-403 every real Pro/Founding Pro user calling Data/Analysis/
-- Research/Decision/Planning/Action Intelligence, or — for Pro —
-- inviting a workspace collaborator) is actually fixed: every affected
-- quota_key now resolves to exactly 1 and has_feature() returns true.
--
-- Users reused from the existing test suite's vetted, safe-to-mutate-
-- within-a-rollback set:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_pro_id uuid;
  v_key text;
  v_limit bigint;
begin
  select id into v_pro_id from public.plans where code = 'pro';

  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_pro_id, true);

  foreach v_key in array array[
    'collaboration', 'data_intelligence', 'analysis_intelligence',
    'research_intelligence', 'decision_intelligence', 'planning_intelligence',
    'action_intelligence'
  ]
  loop
    select public.resolve_effective_quota_limit('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'feature:' || v_key) into v_limit;
    if v_limit is distinct from 1 then
      raise exception 'FEATURE FLAG REPAIR TEST FAILED (1): pro plan feature:% resolves to % (expected 1)', v_key, v_limit;
    end if;
    if not public.has_feature('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_key) then
      raise exception 'FEATURE FLAG REPAIR TEST FAILED (1): has_feature(pro, %) is false', v_key;
    end if;
  end loop;

  raise notice 'FEATURE FLAG REPAIR TEST (1) PASSED: every pro feature:* key resolves to 1 and has_feature() is true';
end;
$$;

rollback;

begin;
set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';

do $$
declare
  v_founding_id uuid;
  v_key text;
  v_limit bigint;
begin
  select id into v_founding_id from public.plans where code = 'founding_pro';

  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '9e733cfc-e6ae-45e6-8b14-dc64247a9cb2' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', v_founding_id, true);

  foreach v_key in array array[
    'collaboration', 'pro_intelligence', 'data_intelligence', 'analysis_intelligence',
    'research_intelligence', 'decision_intelligence', 'planning_intelligence',
    'action_intelligence'
  ]
  loop
    select public.resolve_effective_quota_limit('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'feature:' || v_key) into v_limit;
    if v_limit is distinct from 1 then
      raise exception 'FEATURE FLAG REPAIR TEST FAILED (2): founding_pro feature:% resolves to % (expected 1)', v_key, v_limit;
    end if;
    if not public.has_feature('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', v_key) then
      raise exception 'FEATURE FLAG REPAIR TEST FAILED (2): has_feature(founding_pro, %) is false', v_key;
    end if;
  end loop;

  raise notice 'FEATURE FLAG REPAIR TEST (2) PASSED: every founding_pro feature:* key resolves to 1 and has_feature() is true';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. The corresponding *_intelligence_operations metered quotas are
--    untouched by the repair — still their real, larger monthly ceilings,
--    not collapsed to 1 alongside the boolean fix.
-- ---------------------------------------------------------------------

do $$
declare
  v_pro_id uuid;
  v_limit bigint;
begin
  select id into v_pro_id from public.plans where code = 'pro';
  select quota_limit into v_limit from public.plan_quotas where plan_id = v_pro_id and quota_key = 'data_intelligence_operations';
  if v_limit is null or v_limit = 1 then
    raise exception 'FEATURE FLAG REPAIR TEST FAILED (3): pro data_intelligence_operations was collapsed to % by the feature-flag repair', v_limit;
  end if;
  raise notice 'FEATURE FLAG REPAIR TEST (3) PASSED: pro data_intelligence_operations (%) is untouched by the feature:* repair', v_limit;
end;
$$;
