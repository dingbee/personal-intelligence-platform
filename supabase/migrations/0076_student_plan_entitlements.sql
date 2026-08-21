-- ARRIYIA Commercial Readiness — Student plan: real entitlements.
--
-- Student's price (26,400 TZS/month, 262,000 TZS/year) is already agreed
-- and is NOT touched here — this migration only sets plan_quotas rows,
-- never plans.monthly_price_cents/annual_price_cents/currency.
--
-- Runtime semantics verified directly (not assumed) before writing this:
--   - has_feature(user, key) = resolve_effective_quota_limit(user, 'feature:'||key) = 1
--     (0046_feature_entitlements_and_storage_quota.sql) — a strict boolean
--     equality check. Every `feature:*` row this migration seeds is
--     therefore `1` (grant) or `0` (deny), never a larger number — see
--     0075_feature_flag_boolean_repair.sql's own finding of what happens
--     when a feature:* row holds anything else.
--   - `<engine>_intelligence_operations` keys are the SEPARATE, metered,
--     monthly quota_usage-backed ceiling checked by
--     quotaService.checkQuota/consume_quota (0041), independent of the
--     feature:* boolean gate — both must be set together for a granted
--     capability to actually be usable (0061_intelligence_operation_budgets.sql's
--     own pattern for Pro/Founding Pro).
--   - invite_to_workspace's capacity gate reads max_active_collaborators/
--     max_pending_invitations via resolve_effective_quota_limit directly
--     as a real integer ceiling (0071_free_access_and_collaboration.sql),
--     with -1 as the documented "unlimited" sentinel — Student uses a real
--     3, not -1, matching the exact spec.
--
-- Every row uses upsert-on-conflict so this migration is safe to re-run
-- and correctly overwrites 0067_student_plan.sql's earlier provisional
-- feature:collaboration=0 / storage_bytes=500MB placeholders with the
-- real values below, rather than leaving them stale alongside new rows.

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, v.quota_key, v.quota_limit, 'monthly'
from public.plans p
cross join (values
  ('feature:pro_intelligence', 1),
  ('feature:collaboration', 1),
  ('ai_messages', 750),
  ('storage_bytes', 5368709120),
  ('max_active_collaborators', 3),
  ('max_pending_invitations', 3),
  ('feature:research_intelligence', 1),
  ('research_intelligence_operations', 50),
  ('feature:analysis_intelligence', 1),
  ('analysis_intelligence_operations', 100),
  ('feature:data_intelligence', 1),
  ('data_intelligence_operations', 50),
  ('feature:decision_intelligence', 1),
  ('decision_intelligence_operations', 25),
  ('feature:planning_intelligence', 1),
  ('planning_intelligence_operations', 25),
  ('feature:action_intelligence', 0),
  ('action_intelligence_operations', 0)
) as v(quota_key, quota_limit)
where p.code = 'student'
on conflict (plan_id, quota_key) do update
  set quota_limit = excluded.quota_limit;
