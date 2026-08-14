-- ARRIYIA Professional Intelligence — Data Intelligence Foundation.
--
-- A dedicated entitlement key, deliberately separate from
-- 'feature:pro_intelligence' (0056). Reconciliation approval decided
-- Data Intelligence should not be hardwired to the general Pro
-- Intelligence flag: the persisted structured-dataset infrastructure and
-- the deterministic execution engine (executeAnalyticalPlan) are
-- tier-agnostic by construction and carry no gating of their own — only
-- the exposed capability (data-intelligence-query) is gated, and it is
-- gated on this key specifically. This is what lets a future Student
-- capability request 'feature:data_intelligence' with a more bounded
-- plan shape later, without inheriting every other Pro Intelligence
-- capability, and without any change to this migration, the table, or
-- the execution engine.
--
-- Reuses the exact same plan_quotas / has_feature machinery as every
-- other feature flag (0046, 0056) — no new table, column, or RPC.
--
-- Seeded for 'pro' and 'founding_pro' only, matching 0056's own scope
-- exactly (Founding Pro inherits identically, through the same
-- user_plan_assignments row every other plan check reads). Not granted
-- to free/beta/enterprise here — extending it later is a one-row insert,
-- not an architecture change.
insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:data_intelligence', 1, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;
