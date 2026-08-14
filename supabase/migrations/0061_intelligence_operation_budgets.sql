-- ARRIYIA — Operation Budget Foundation. Closes the gap the autonomy/
-- cost/quota architecture audit (docs/autonomy-cost-quota-architecture-
-- audit.md) identified: Data/Analysis/Research Intelligence are
-- feature-gated (has_feature/feature:*) but consume zero metered quota,
-- unlike ordinary chat's 'ai_messages'. This migration is purely
-- additive:
--
--   1. Three new plan_quotas rows (one per engine) using the exact same
--      table/RPC family 'ai_messages' already uses — no new quota
--      mechanism, no second quota_usage table.
--   2. Two new nullable columns on ai_requests (operation_id,
--      operation_type) so multiple AI calls belonging to one bounded
--      intelligence operation (including every provider-fallback
--      attempt) can be grouped and audited after the fact, without
--      touching any existing row or existing RLS policy.
--
-- Starting quota_limit values below are deliberately generous defaults,
-- not a business/pricing decision baked into code — identical in spirit
-- to 0045_founding_pro_plan.sql's own "starting default... changeable at
-- any time via admin_update_plan_quota" precedent. Pro and Founding Pro
-- receive the same starting value here, mirroring that same migration's
-- choice for 'ai_messages'.

-- ---------------------------------------------------------------------
-- 1. Operation-type quota keys — real, monthly-scoped, metered usage
--    counters (distinct from the existing feature:* boolean entitlement
--    keys, which never increment). One quota_key per intelligence
--    engine, resolved/consumed through the existing
--    resolve_effective_quota_limit / consume_quota RPCs exactly like
--    'ai_messages' already is (see src/shared/lib/intelligenceOperations.ts).
-- ---------------------------------------------------------------------

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'data_intelligence_operations', 1000, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'analysis_intelligence_operations', 1000, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'research_intelligence_operations', 1000, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;

-- ---------------------------------------------------------------------
-- 2. ai_requests.operation_id / operation_type — additive, nullable
--    grouping metadata. Existing rows are unaffected (both null).
--    Existing RLS ("Users view their own AI requests", auth.uid() =
--    user_id) already scopes any select on these new columns to the
--    row owner — no new policy is needed for a user to be unable to see
--    another user's operation grouping, since they can never see
--    another user's ai_requests rows at all, with or without these
--    columns. See supabase/tests/intelligence_operation_budget_security_test.sql.
-- ---------------------------------------------------------------------

alter table public.ai_requests
  add column if not exists operation_id uuid,
  add column if not exists operation_type text;

create index if not exists ai_requests_operation_id_idx on public.ai_requests (operation_id) where operation_id is not null;
