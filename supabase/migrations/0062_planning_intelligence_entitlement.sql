-- ARRIYIA Professional Intelligence — Planning Intelligence.
--
-- Follows the exact two-part precedent every prior professional-
-- intelligence engine established: a dedicated feature:* entitlement key
-- (0058/0059/0060) plus its own *_operations metered quota key (0061) —
-- seeded together here in one migration since, unlike Data/Analysis/
-- Research Intelligence (each shipped before Operation Budget Foundation
-- existed), Planning Intelligence is introduced after that foundation
-- and can adopt both conventions from the start rather than in two
-- historically-separate sprints.
--
-- Naming note: this migration deliberately does NOT touch, extend, or
-- rename anything under the existing public.plans table (the billing-
-- tier catalog from 0044_commercial_schema_reconciliation.sql —
-- Free/Pro/Founding Pro/etc). "Planning Intelligence" and "plans" (the
-- billing concept) are unrelated; both quota_key values below use the
-- 'planning_intelligence' prefix specifically to avoid ever being
-- confused with a billing plan.
--
-- Purely additive: two INSERTs into the existing plan_quotas table,
-- ON CONFLICT DO NOTHING, no new table, no new column, no RLS change.
-- Seeded for 'pro' and 'founding_pro' only, matching every sibling
-- engine's own scope exactly.

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:planning_intelligence', 1, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'planning_intelligence_operations', 1000, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;
