-- Pricing, Founding Pro Access & Legacy Beta Consolidation — Student plan.
--
-- Introduces `student` as a real, independent `plans` row, following the
-- exact precedent 0045_founding_pro_plan.sql set for Founding Pro: a
-- plan is a first-class catalog row, never a UI-only label. Positioning
-- copy only ("For students, researchers and academic users.") — no
-- final price is set (`monthly_price_cents`/`annual_price_cents` stay
-- NULL, exactly like every other plan today; PricingPage already
-- renders NULL as "Pricing to be announced").
--
-- Quota seeding is deliberately conservative and explicitly provisional,
-- for the same reason 0045 gave for Founding Pro's starting quota: "a
-- starting default, not a business decision baked into code." This repo
-- has no authoritative Free/Pro ai_messages figures anywhere in migration
-- history (those rows were seeded directly in production before
-- migrations were the source of truth — see 0044's own comment), so
-- inventing an ai_messages number for Student here would fabricate a
-- business decision this migration has no basis for. Student's
-- ai_messages quota is therefore deliberately left unseeded (no row —
-- PublicPlanTier.aiMessagesPerMonth resolves to null, which the pricing
-- UI already renders as a generic "AI messages / month" line, not a
-- fake number).
--
-- storage_bytes and feature:collaboration ARE seeded, because both have
-- a clear, defensible default already established by this same
-- migration history: 524288000 (500MB) is exactly Free's existing
-- storage_bytes value (0046_feature_entitlements_and_storage_quota.sql),
-- and collaboration=0 follows that same migration's own rule
-- ("case when p.code = 'free' then 0 else 1 end") for a single-owner,
-- individual-use plan. Student mirrors Free's profile until a business
-- decision sets Student-specific limits — this is a real configuration
-- decision still required, documented in the production-truth doc, not
-- silently invented as final.
--
-- plan_ai_providers IS seeded (mirroring Free's single-provider
-- default) because, unlike pricing/quota numbers, an empty
-- plan_ai_providers set is not "no decision yet" — it is a functional
-- outage: listPlanAiProviders() returns zero providers for a plan with
-- no rows, which would make every AI capability unusable for Student
-- users. This is the same mechanical seeding 0049 already performed for
-- every other plan, required for basic correctness, not a pricing choice.

insert into public.plans (code, name, description, active)
values ('student', 'Student', 'For students, researchers and academic users.', true)
on conflict (code) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:collaboration', 0, 'monthly'
from public.plans p
where p.code = 'student'
on conflict (plan_id, quota_key) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'storage_bytes', 524288000, 'monthly'
from public.plans p
where p.code = 'student'
on conflict (plan_id, quota_key) do nothing;

insert into public.plan_ai_providers (plan_id, provider_id, active, priority)
select p.id, 'anthropic', true, 0
from public.plans p
where p.code = 'student'
on conflict (plan_id, provider_id) do nothing;
