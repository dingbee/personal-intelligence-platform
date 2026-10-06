-- ARRIYIA V2-02 — Enterprise Space lifecycle.
--
-- V2 business Spaces reuse the existing workspace + membership substrate.
-- This avoids a second collaboration model while keeping V2 Space semantics
-- distinct from the legacy V1 workspace selector.
--
-- Personal Space remains identity-scoped and synthetic in the V2 shell.
-- Business Space is persistent and membership-backed.

alter table public.workspaces
  add column if not exists v2_kind text,
  add column if not exists v2_status text,
  add column if not exists v2_subscription text,
  add column if not exists v2_organization_id uuid,
  add column if not exists v2_pause_reason text;

alter table public.workspaces
  add constraint workspaces_v2_kind_check
    check (v2_kind is null or v2_kind in ('business')),
  add constraint workspaces_v2_status_check
    check (v2_status is null or v2_status in ('active', 'paused', 'archived')),
  add constraint workspaces_v2_subscription_check
    check (v2_subscription is null or v2_subscription = 'enterprise'),
  add constraint workspaces_v2_pause_reason_check
    check (v2_pause_reason is null or v2_pause_reason in ('manual', 'entitlement'));

create unique index if not exists workspaces_one_v2_business_space_per_owner_idx
  on public.workspaces (user_id)
  where v2_kind = 'business';

create index if not exists workspaces_v2_kind_idx
  on public.workspaces (v2_kind);

create index if not exists workspaces_v2_organization_id_idx
  on public.workspaces (v2_organization_id);

-- A V2 Business Space uses its workspace id as the stable organization/tenant
-- namespace presented to NoVA Core. There is intentionally no second
-- organizations table in V2-02; introducing one would duplicate the already
-- working workspace membership boundary. This mapping is explicit and can be
-- replaced by a first-class organization entity later without changing the
-- V2 Space API.
create or replace function public.prepare_arriyia_v2_business_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_enterprise boolean;
begin
  if new.v2_kind is null then
    return new;
  end if;

  if new.v2_kind <> 'business' then
    raise exception 'ARRIYIA V2 Space kind is immutable';
  end if;

  if new.v2_subscription is null then
    new.v2_subscription := 'enterprise';
  elsif new.v2_subscription <> 'enterprise' then
    raise exception 'ARRIYIA Business Space requires enterprise subscription';
  end if;

  if new.v2_organization_id is null then
    new.v2_organization_id := new.id;
  end if;

  if new.v2_status is null then
    new.v2_status := 'active';
  end if;

  if tg_op = 'UPDATE' and old.v2_kind is not null and old.v2_kind <> new.v2_kind then
    raise exception 'ARRIYIA V2 Space kind is immutable';
  end if;

  if tg_op = 'UPDATE'
     and old.v2_subscription is not null
     and old.v2_subscription <> new.v2_subscription then
    raise exception 'ARRIYIA V2 Space subscription is immutable';
  end if;

  select exists (
    select 1
    from public.user_plan_assignments upa
    join public.plans p on p.id = upa.plan_id
    where upa.user_id = new.user_id
      and upa.active = true
      and p.code = 'enterprise'
  ) into v_has_enterprise;

  if new.v2_status = 'active' and not v_has_enterprise then
    raise exception 'ARRIYIA Enterprise entitlement is required to activate a Business Space';
  end if;

  -- A normal authenticated owner pausing an active space is a deliberate
  -- lifecycle action. System entitlement syncs set the reason explicitly.
  if tg_op = 'UPDATE'
     and new.v2_status = 'paused'
     and old.v2_status = 'active'
     and auth.uid() is not null then
    new.v2_pause_reason := 'manual';
  end if;

  if new.v2_status <> 'paused' then
    new.v2_pause_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_arriyia_v2_business_space on public.workspaces;
create trigger prepare_arriyia_v2_business_space
  before insert or update on public.workspaces
  for each row execute function public.prepare_arriyia_v2_business_space();

-- One authoritative sync primitive: Business Spaces are active only while the
-- identity has an active Enterprise entitlement. Payment/webhook processing
-- ultimately updates user_plan_assignments, so both billing and admin plan
-- changes converge here.
create or replace function public.sync_arriyia_v2_business_spaces(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_enterprise boolean;
begin
  select exists (
    select 1
    from public.user_plan_assignments upa
    join public.plans p on p.id = upa.plan_id
    where upa.user_id = p_user_id
      and upa.active = true
      and p.code = 'enterprise'
  ) into v_has_enterprise;

  if v_has_enterprise then
    update public.workspaces
    set v2_status = 'active',
        v2_pause_reason = null,
        updated_at = now()
    where user_id = p_user_id
      and v2_kind = 'business'
      and v2_status = 'paused'
      and v2_pause_reason = 'entitlement';
  else
    update public.workspaces
    set v2_status = 'paused',
        v2_pause_reason = 'entitlement',
        updated_at = now()
    where user_id = p_user_id
      and v2_kind = 'business'
      and v2_status = 'active';
  end if;
end;
$$;

revoke all on function public.sync_arriyia_v2_business_spaces(uuid) from public, anon, authenticated;

create or replace function public.sync_arriyia_v2_business_spaces_from_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_arriyia_v2_business_spaces(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_arriyia_v2_business_spaces_after_plan_change on public.user_plan_assignments;
create trigger sync_arriyia_v2_business_spaces_after_plan_change
  after insert or update or delete on public.user_plan_assignments
  for each row execute function public.sync_arriyia_v2_business_spaces_from_plan();

-- Existing workspace RLS already gives active members access and owner-only
-- mutation. Add no broad client policy here: V2 Business Space creation
-- uses the same owner INSERT path as an ordinary workspace, while the trigger
-- above enforces Enterprise entitlement at the database boundary.

comment on column public.workspaces.v2_kind is
  'ARRIYIA V2 Space discriminator. Null means legacy workspace; business means persistent V2 Business Space.';
comment on column public.workspaces.v2_status is
  'ARRIYIA V2 Business Space lifecycle state: active, paused, archived.';
comment on column public.workspaces.v2_subscription is
  'ARRIYIA V2 Business Space commercial tier. Business Spaces require enterprise.';
comment on column public.workspaces.v2_organization_id is
  'ARRIYIA V2 tenant namespace exposed to NoVA Core. V2-02 maps this to the Space/workspace id.';
comment on column public.workspaces.v2_pause_reason is
  'ARRIYIA V2 lifecycle pause source: manual owner action or lost Enterprise entitlement.';
