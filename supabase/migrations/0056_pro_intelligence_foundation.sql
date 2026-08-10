-- ARRIYIA Professional Intelligence — Phase P0: Pro Intelligence Foundation.
--
-- Establishes the one entitlement fact every future Advanced AI Workspace /
-- Research / Planning / Deep Academic Intelligence module will gate on:
-- "does this user have Pro Intelligence capability". Reuses the existing
-- plan_quotas / resolve_effective_quota_limit / has_feature machinery
-- exactly as 0046_feature_entitlements_and_storage_quota.sql already does
-- for 'feature:collaboration' — a boolean feature flag is just another
-- quota_key whose value is 0 or 1. No new table, column, or RPC.
--
-- Founding Pro receives this automatically and identically to Pro: both
-- plan codes are seeded with the same value below, and Founding Pro
-- membership already flows through the same active user_plan_assignments
-- row every other plan resolution reads (see
-- founding_pro_enroll_member_core in 0055) — there is no separate
-- "Founding Pro intelligence" code path to build or maintain.
--
-- Deliberately NOT granted here:
--   - free / beta — unaffected. No row is inserted, so has_feature falls
--     back to its documented default-deny (missing plan_quotas row ->
--     null plan limit -> coalesce(...,0) = 1 is false). Existing Beta
--     grandfathering is untouched by this migration.
--   - enterprise — Business must remain outside this foundation per the
--     Phase P0 brief. Extending Pro Intelligence to a future Business
--     plan is a one-line insert here, not an architecture change, when
--     that phase is scoped.
insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:pro_intelligence', 1, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;
