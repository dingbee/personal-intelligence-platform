-- ARRIYIA Professional Intelligence — Research Intelligence (P2).
--
-- A dedicated entitlement key, mirroring 0056 (feature:pro_intelligence),
-- 0058 (feature:data_intelligence), and 0059 (feature:analysis_intelligence)
-- exactly. See src/modules/plans/researchIntelligence.ts's doc comment for
-- why P2 follows the dedicated-key precedent rather than the brief's
-- literal fallback of gating on 'pro_intelligence' directly: this is the
-- "demonstrably better established mechanism" that fallback clause
-- anticipates, and it costs nothing extra — one more row in the same
-- table, resolved by the same has_feature RPC every other feature flag
-- already uses.
--
-- Reuses the exact same plan_quotas / has_feature machinery as every
-- other feature flag — no new table, column, or RPC.
--
-- Seeded for 'pro' and 'founding_pro' only, matching 0056/0058/0059's own
-- scope exactly (Founding Pro inherits identically, through the same
-- user_plan_assignments row every other plan check reads).
insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:research_intelligence', 1, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;
