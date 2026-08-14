-- ARRIYIA Professional Intelligence — Decision Intelligence.
--
-- Follows the exact precedent 0062 (Planning Intelligence) established:
-- a dedicated feature:* entitlement key plus its own *_operations
-- metered quota key, seeded together in one migration. Purely additive:
-- two INSERTs into the existing plan_quotas table, ON CONFLICT DO
-- NOTHING, no new table, no new column, no RLS change. Seeded for 'pro'
-- and 'founding_pro' only, matching every sibling engine's own scope.

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:decision_intelligence', 1, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'decision_intelligence_operations', 1000, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;
