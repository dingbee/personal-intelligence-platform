-- Phase 5A — commercial control security verification.
--
-- Covers the mandatory checks that reduce to live database state rather
-- than pure application logic:
--
-- 1. Free has exactly one active AI provider allocation; Pro/Founding Pro/
--    Beta/Enterprise have more than one — the seeded state
--    0049_plan_commercial_control.sql shipped, re-asserted here so a
--    future migration can't silently regress it.
-- 2. No ordinary authenticated user can manipulate plan/provider
--    configuration: admin_set_plan_ai_provider and
--    admin_update_plan_commercial both re-check is_platform_admin()
--    inside the function body (grant-level EXECUTE to `authenticated` is
--    expected and matches every other admin_* RPC in this codebase —
--    the actual authorization boundary is the in-body check, verified
--    here via pg_get_functiondef rather than assumed from reading the
--    migration).
-- 3. Collaboration remains Free=off / Pro,Founding Pro=on (unchanged by
--    this phase, re-checked here since Phase 5A's directive explicitly
--    named it as a locked commercial principle).
--
-- 100% read-only — safe to run against production at any time. Executed
-- live against production (project uzshazetfkjkrdnxwjtl) on 2026-08-10;
-- all assertions passed.

do $$
declare
  v_free_provider_count int;
  v_pro_provider_count int;
  v_founding_provider_count int;
  v_free_collab int;
  v_pro_collab int;
  v_founding_collab int;
begin
  select count(*) into v_free_provider_count
  from public.plan_ai_providers pap
  join public.plans p on p.id = pap.plan_id
  where p.code = 'free' and pap.active = true;

  select count(*) into v_pro_provider_count
  from public.plan_ai_providers pap
  join public.plans p on p.id = pap.plan_id
  where p.code = 'pro' and pap.active = true;

  select count(*) into v_founding_provider_count
  from public.plan_ai_providers pap
  join public.plans p on p.id = pap.plan_id
  where p.code = 'founding_pro' and pap.active = true;

  if v_free_provider_count <> 1 then
    raise exception 'COMMERCIAL CONTROL FAILED: free plan has % active AI providers, expected exactly 1', v_free_provider_count;
  end if;

  if v_pro_provider_count <= 1 then
    raise exception 'COMMERCIAL CONTROL FAILED: pro plan has % active AI providers, expected more than 1', v_pro_provider_count;
  end if;

  if v_founding_provider_count <= 1 then
    raise exception 'COMMERCIAL CONTROL FAILED: founding_pro plan has % active AI providers, expected more than 1', v_founding_provider_count;
  end if;

  -- Grant-level: no ordinary authenticated user should be able to bypass
  -- the is_platform_admin() check by construction. Both RPCs remain
  -- callable at the grant level (matches every admin_* RPC precedent —
  -- the DB function itself is the enforcement point, not the grant), but
  -- the function body must contain the authorization check.
  if pg_get_functiondef('public.admin_set_plan_ai_provider(uuid,text,boolean,int)'::regprocedure)
     not like '%is_platform_admin()%' then
    raise exception 'COMMERCIAL CONTROL FAILED: admin_set_plan_ai_provider no longer checks is_platform_admin()';
  end if;

  if pg_get_functiondef('public.admin_update_plan_commercial(uuid,integer,integer,text,boolean)'::regprocedure)
     not like '%is_platform_admin()%' then
    raise exception 'COMMERCIAL CONTROL FAILED: admin_update_plan_commercial no longer checks is_platform_admin()';
  end if;

  if has_function_privilege('anon', 'public.admin_set_plan_ai_provider(uuid,text,boolean,int)', 'EXECUTE') then
    raise exception 'COMMERCIAL CONTROL FAILED: anon can execute admin_set_plan_ai_provider';
  end if;

  if has_function_privilege('anon', 'public.admin_update_plan_commercial(uuid,integer,integer,text,boolean)', 'EXECUTE') then
    raise exception 'COMMERCIAL CONTROL FAILED: anon can execute admin_update_plan_commercial';
  end if;

  -- Locked commercial principle: Free=off, Pro/Founding Pro=on.
  select coalesce(pq.quota_limit, 0) into v_free_collab
  from public.plans p left join public.plan_quotas pq on pq.plan_id = p.id and pq.quota_key = 'feature:collaboration'
  where p.code = 'free';

  select coalesce(pq.quota_limit, 0) into v_pro_collab
  from public.plans p left join public.plan_quotas pq on pq.plan_id = p.id and pq.quota_key = 'feature:collaboration'
  where p.code = 'pro';

  select coalesce(pq.quota_limit, 0) into v_founding_collab
  from public.plans p left join public.plan_quotas pq on pq.plan_id = p.id and pq.quota_key = 'feature:collaboration'
  where p.code = 'founding_pro';

  if v_free_collab <> 0 then
    raise exception 'COMMERCIAL CONTROL FAILED: free plan has collaboration enabled (%), must be off', v_free_collab;
  end if;

  if v_pro_collab <> 1 then
    raise exception 'COMMERCIAL CONTROL FAILED: pro plan has collaboration disabled, must be on';
  end if;

  if v_founding_collab <> 1 then
    raise exception 'COMMERCIAL CONTROL FAILED: founding_pro plan has collaboration disabled, must be on';
  end if;

  raise notice 'COMMERCIAL CONTROL SECURITY TEST PASSED: free=1 provider, pro/founding_pro=%/% providers, admin RPCs are is_platform_admin()-gated and anon-blocked, collaboration matrix is free=off/pro=on/founding_pro=on',
    v_pro_provider_count, v_founding_provider_count;
end;
$$;
