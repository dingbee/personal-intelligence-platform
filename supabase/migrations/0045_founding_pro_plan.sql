-- Phase 4 Commercial Architecture — Founding Pro plan catalog entry.
--
-- Founding Pro must be a real, independent plans row — never "Pro plus a
-- flag" — so that a future edit to `pro`'s plan_quotas (e.g. raising or
-- lowering ordinary Pro's limits) can never silently change a Founding
-- Pro subscriber's grandfathered terms. That isolation is a property of
-- plan_quotas being keyed by plan_id: editing the `pro` row's quotas
-- via the existing admin_update_plan_quota RPC only ever touches rows
-- where plan_id = pro's id, never founding_pro's id.
--
-- Quota seeding: founding_pro's ai_messages limit is seeded to exactly
-- match pro's current live value (10000/month) at the moment of this
-- migration — "Founding Pro should receive the Pro capability set."
-- This is a starting default, not a business decision baked into code:
-- the actual number is changeable at any time via
-- admin_update_plan_quota(founding_pro_id, 'ai_messages', <new_limit>),
-- scoped to founding_pro alone, exactly like any other plan. The exact
-- commercial price and long-term grandfathering policy remain
-- business-controlled and are intentionally not represented here at
-- all — this table has never stored a price, and continues not to.
--
-- feature:* quota_key rows (collaboration / expanded_storage /
-- provider_selection) are added in the next migration once plan_quotas'
-- generic (plan, key) -> value shape is established as the feature-flag
-- mechanism for all four plans at once — kept separate here so this
-- migration's sole concern is "founding_pro exists as an isolated plan."

insert into public.plans (code, name, description, active)
values ('founding_pro', 'Founding Pro', 'Grandfathered early-adopter Pro plan — commercial terms set independently of ordinary Pro.', true)
on conflict (code) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'ai_messages', 10000, 'monthly'
from public.plans p
where p.code = 'founding_pro'
on conflict (plan_id, quota_key) do nothing;
