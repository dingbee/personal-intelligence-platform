-- ARRIYIA Professional Intelligence — Analysis Intelligence.
--
-- A dedicated entitlement key, mirroring 0056 (feature:pro_intelligence)
-- and 0058 (feature:data_intelligence) exactly. Analysis Intelligence is
-- gated separately from Data Intelligence for the same reason Data
-- Intelligence was gated separately from general Pro Intelligence (see
-- 0058's own comment, and docs/analysis-intelligence-architecture-
-- audit.md §14/§22): the investigation loop and its step-budget
-- constant are tier-agnostic infrastructure with no gating of their
-- own — only the exposed capability (analysis-investigation-synthesis)
-- is gated, on this key specifically. A future bounded Student
-- capability can request 'feature:analysis_intelligence' with its own
-- (smaller) step budget later without inheriting Data Intelligence or
-- general Pro Intelligence, and without any change to this migration
-- or the investigation engine.
--
-- Reuses the exact same plan_quotas / has_feature machinery as every
-- other feature flag — no new table, column, or RPC.
--
-- Seeded for 'pro' and 'founding_pro' only, matching 0056/0058's own
-- scope exactly (Founding Pro inherits identically, through the same
-- user_plan_assignments row every other plan check reads).
insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:analysis_intelligence', 1, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;
