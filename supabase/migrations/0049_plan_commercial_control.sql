-- Phase 5A — ARRIYIA Commercial Control & Billing Integration Preparation.
--
-- Two additions, both provider-independent and payment-provider-agnostic:
--
-- 1. Commercial pricing metadata on `plans` (monthly/annual price,
--    currency) — configuration/data only, never read by any entitlement
--    or quota logic. Left NULL for every plan: no final pricing has been
--    decided yet (payment provider selection is still pending — see
--    docs/phase4-commercial-architecture.md §9/§19), and inventing a
--    number here would misrepresent a business decision as already made.
--    `currency` defaults to 'USD' as a harmless placeholder, changeable
--    per plan by an admin at any time.
--
-- 2. `plan_ai_providers` — the plan -> allowed-AI-provider matrix. AI
--    provider identity must never be visible to ordinary users (see
--    ExplainAnswerPanel.tsx's fix in this same phase) and is now also
--    plan-governed: Free gets exactly one enabled provider, Pro/Founding
--    Pro/Beta/Enterprise get the full set, admin-configurable without
--    touching this table's shape or any application code — a new
--    provider is just a new row. This is deliberately a *second*,
--    plan-scoped table rather than an extension of
--    `platform_provider_settings` (0036_founder_command_center.sql):
--    that table is a platform-wide kill switch ("this provider is down/
--    disabled for everyone, full stop"), orthogonal to "which plans get
--    to use it" — resolveProviderChain intersects both, and conflating
--    them would make platform_provider_settings's own semantics load-
--    bearing for pricing entitlement, which it was never designed for.

alter table public.plans
  add column monthly_price_cents integer,
  add column annual_price_cents integer,
  add column currency text not null default 'USD';

create table public.plan_ai_providers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  provider_id text not null,
  priority int not null default 0,
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint plan_ai_providers_plan_provider_key unique (plan_id, provider_id)
);

alter table public.plan_ai_providers enable row level security;

-- Authenticated-read-all, matching platform_provider_settings' own
-- precedent: the client-side provider chain (useProviderChain) needs to
-- read a user's own plan's allowed-provider set to route requests, but
-- what it reads is provider *ids* only (e.g. "anthropic") — never a
-- model name, a display label, or anything that lets a user distinguish
-- providers by name in the UI (ExplainAnswerPanel no longer renders one
-- at all, and nothing else in the app surfaces provider_id as text).
create policy "Authenticated users can view plan ai providers"
  on public.plan_ai_providers for select
  to authenticated
  using (true);

revoke insert, update, delete, truncate on public.plan_ai_providers from anon, authenticated;
revoke select, insert, update, delete, truncate on public.plan_ai_providers from anon;

-- ---------------------------------------------------------------------
-- admin_set_plan_ai_provider — the only write path for the matrix.
-- Mirrors admin_set_platform_provider_setting's exact shape (upsert on
-- conflict, is_platform_admin() gate, authenticated-grantable because the
-- function re-checks admin status itself).
-- ---------------------------------------------------------------------

create or replace function public.admin_set_plan_ai_provider(
  p_plan_id uuid,
  p_provider_id text,
  p_active boolean,
  p_priority int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.plan_ai_providers (plan_id, provider_id, active, priority, updated_by, updated_at)
  values (p_plan_id, p_provider_id, p_active, p_priority, auth.uid(), now())
  on conflict (plan_id, provider_id)
  do update set active = p_active, priority = p_priority, updated_by = auth.uid(), updated_at = now();
end;
$$;

revoke execute on function public.admin_set_plan_ai_provider(uuid, text, boolean, int) from public, anon;
grant execute on function public.admin_set_plan_ai_provider(uuid, text, boolean, int) to authenticated;

-- ---------------------------------------------------------------------
-- admin_update_plan_commercial — pricing metadata + active flag. Kept
-- separate from admin_update_plan_quota (which continues to own
-- plan_quotas rows exclusively) since price/currency/active live on
-- `plans` itself, a different table with different semantics.
-- ---------------------------------------------------------------------

create or replace function public.admin_update_plan_commercial(
  p_plan_id uuid,
  p_monthly_price_cents integer,
  p_annual_price_cents integer,
  p_currency text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  update public.plans
  set monthly_price_cents = p_monthly_price_cents,
      annual_price_cents = p_annual_price_cents,
      currency = p_currency,
      active = p_active
  where id = p_plan_id;
end;
$$;

revoke execute on function public.admin_update_plan_commercial(uuid, integer, integer, text, boolean) from public, anon;
grant execute on function public.admin_update_plan_commercial(uuid, integer, integer, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Seed data — Free gets exactly one provider (the mandatory constraint
-- from Phase 5A's directive); Beta/Pro/Founding Pro/Enterprise get every
-- currently-registered chat provider, preserving today's de facto
-- behavior (no plan-level restriction existed before this migration, so
-- every plan effectively had access to every available provider — Beta/
-- Enterprise must not regress to zero providers as a side effect of
-- Free/Pro finally being restricted). 'anthropic' is picked as Free's
-- sole provider arbitrarily — which specific provider is a business/ops
-- decision an admin can change at any time via admin_set_plan_ai_provider,
-- never hard-coded into any entitlement or routing logic.
-- ---------------------------------------------------------------------

insert into public.plan_ai_providers (plan_id, provider_id, active, priority)
select p.id, 'anthropic', true, 0
from public.plans p
where p.code = 'free';

insert into public.plan_ai_providers (plan_id, provider_id, active, priority)
select p.id, provider.id, true, provider.priority
from public.plans p
cross join (values ('anthropic', 2), ('openai', 1), ('google', 0)) as provider(id, priority)
where p.code in ('beta', 'pro', 'founding_pro', 'enterprise');
