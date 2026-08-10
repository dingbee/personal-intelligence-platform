-- Phase 5C fix — public /pricing accessibility.
--
-- /pricing must render Free/Pro correctly for a genuinely logged-out
-- visitor (confirmed broken in manual testing: the route redirected to
-- /login before ever reaching PricingPage). Making the route itself
-- public (this migration's companion router.tsx change) is necessary but
-- not sufficient: `plans` and `plan_quotas` RLS was authenticated-only
-- (0034_beta_invite_quota_repair.sql's "Authenticated users can view
-- plans/plan_quotas" policies never granted `anon`), so even with the
-- route reachable, an anonymous visitor's client would get zero rows back
-- and the page would render with no plan data.
--
-- This grants `anon` the exact same SELECT-only access `authenticated`
-- already has on these two tables — both are commercial catalog/config
-- data (plan names, prices, quota numbers), never user data, so there is
-- nothing sensitive being newly exposed. `plan_ai_providers` is
-- deliberately NOT touched here: AI provider identity must never be
-- visible to any user, authenticated or not, and PricingPage's own
-- getPublicPlanCatalog() never selects that table regardless of what RLS
-- would allow — this migration doesn't change that boundary.

create policy "Anonymous users can view plans"
  on public.plans for select
  to anon
  using (true);

create policy "Anonymous users can view plan quotas"
  on public.plan_quotas for select
  to anon
  using (true);

-- RLS policies alone are not sufficient — 0044_commercial_schema_-
-- reconciliation.sql explicitly revoked the base SELECT privilege from
-- `anon` on both tables (a policy only takes effect if the role already
-- holds the underlying SQL privilege). Grant it back, SELECT only —
-- write privileges remain revoked, unchanged.
grant select on public.plans to anon;
grant select on public.plan_quotas to anon;
