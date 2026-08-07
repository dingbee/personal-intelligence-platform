-- Founder Command Center & AI Governance Phase.
--
-- Six additive capabilities, all SECURITY DEFINER, all internally
-- re-checking is_platform_admin() and raising on a non-admin caller —
-- the exact pattern 0035_platform_admin_foundation.sql established.
-- Nothing here is a client-reachable table write; every mutation goes
-- through one of these functions, same as every admin capability so far.

-- ---------------------------------------------------------------------
-- Defect found while preparing admin_change_user_plan: user_plan_
-- assignments_user_id_active_key is a literal UNIQUE(user_id, active),
-- which caps a user at one active row AND one inactive row ever — a
-- second plan change for the same user would fail deactivating the
-- first. Confirmed live: 1 row total exists today (the founder's own,
-- still active), so nothing is at risk. Replaced with the same shape of
-- fix 0028_workspace_members.sql already uses for the identical "at
-- most one active X per user" invariant: a partial unique index, which
-- keeps the "one active assignment" guarantee while allowing unlimited
-- inactive history rows.
-- ---------------------------------------------------------------------

alter table public.user_plan_assignments
  drop constraint user_plan_assignments_user_id_active_key;

create unique index user_plan_assignments_one_active_idx
  on public.user_plan_assignments (user_id)
  where active;

-- ---------------------------------------------------------------------
-- admin_change_user_plan — the first write path to user_plan_
-- assignments other than assign_default_plan (which only ever fires
-- once, on signup). Deactivates the current active row (if any) and
-- inserts a new active one; never deletes or overwrites history.
-- ---------------------------------------------------------------------

create or replace function public.admin_change_user_plan(p_user_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'Unknown plan';
  end if;

  update public.user_plan_assignments
  set active = false, ends_at = now()
  where user_id = p_user_id and active = true;

  insert into public.user_plan_assignments (user_id, plan_id, active)
  values (p_user_id, p_plan_id, true);
end;
$$;

revoke execute on function public.admin_change_user_plan(uuid, uuid) from public;
revoke execute on function public.admin_change_user_plan(uuid, uuid) from anon;
grant execute on function public.admin_change_user_plan(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- admin_reset_user_quota — the first write path to quota_usage other
-- than consume_quota (which only ever increments). Zeroes the CURRENT
-- period's row only (mirrors admin_revoke_beta_invite's "never touch
-- history" discipline) — past periods' usage_count rows are left
-- exactly as they are, since they're a usage record, not live state.
-- ---------------------------------------------------------------------

create or replace function public.admin_reset_user_quota(p_user_id uuid, p_quota_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  update public.quota_usage
  set usage_count = 0, updated_at = now()
  where user_id = p_user_id
    and quota_key = p_quota_key
    and period_start = date_trunc('month', now());
end;
$$;

revoke execute on function public.admin_reset_user_quota(uuid, text) from public;
revoke execute on function public.admin_reset_user_quota(uuid, text) from anon;
grant execute on function public.admin_reset_user_quota(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- admin_set_user_disabled — real auth-level enforcement via auth.users.
-- banned_until (checked by Supabase Auth itself on sign-in and token
-- refresh, not just hidden in the UI), not a cosmetic profiles flag.
-- Self-disable is explicitly blocked: granting admin status has no
-- client-reachable path at all (0035), so a founder locking out their
-- own account would have no recovery route.
-- ---------------------------------------------------------------------

create or replace function public.admin_set_user_disabled(p_user_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot disable your own account';
  end if;

  update auth.users
  set banned_until = case when p_disabled then 'infinity'::timestamptz else null end
  where id = p_user_id;
end;
$$;

revoke execute on function public.admin_set_user_disabled(uuid, boolean) from public;
revoke execute on function public.admin_set_user_disabled(uuid, boolean) from anon;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- admin_list_users needs to surface is_disabled so the new Users page
-- can render/toggle account status without a second round trip. Adding
-- an OUT column changes the function's return signature, which Postgres
-- won't let `create or replace` do in place — drop then recreate, same
-- body plus one extra select expression derived from the auth.users.
-- banned_until column admin_set_user_disabled above writes.
-- ---------------------------------------------------------------------

drop function public.admin_list_users();

create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  plan_code text,
  plan_name text,
  quota_used bigint,
  quota_limit bigint,
  beta_status text,
  is_disabled boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select
      p.id,
      p.email,
      p.display_name,
      p.created_at,
      u.last_sign_in_at,
      pl.code,
      pl.name,
      qu.usage_count,
      pq.quota_limit,
      bi.status,
      (u.banned_until is not null and u.banned_until > now())
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.user_plan_assignments upa on upa.user_id = p.id and upa.active = true
    left join public.plans pl on pl.id = upa.plan_id
    left join public.plan_quotas pq on pq.plan_id = pl.id and pq.quota_key = 'ai_messages'
    left join public.quota_usage qu
      on qu.user_id = p.id and qu.quota_key = 'ai_messages' and qu.period_start = date_trunc('month', now())
    left join public.beta_invites bi on lower(bi.email) = lower(p.email)
    order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public;
revoke execute on function public.admin_list_users() from anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------
-- platform_provider_settings — genuinely new: no platform-wide provider
-- concept existed before this (provider_overrides is per-user only,
-- 0034/prior phase). Authenticated-read-all so resolveProviderChain can
-- factor it in client-side; zero client write policies, write only via
-- admin_set_platform_provider_setting below. `enabled = false` here can
-- only REMOVE a provider from the eligible set — it is combined with,
-- never replaces, the existing key-presence/isProviderAvailable check;
-- a provider with no API key configured is never made "available" by
-- this table no matter what it says.
-- ---------------------------------------------------------------------

create table public.platform_provider_settings (
  provider_id text primary key,
  enabled boolean not null default true,
  priority int not null default 0,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.platform_provider_settings enable row level security;

create policy "Authenticated users can view platform provider settings"
  on public.platform_provider_settings for select
  to authenticated
  using (true);

create or replace function public.admin_set_platform_provider_setting(
  p_provider_id text,
  p_enabled boolean,
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

  insert into public.platform_provider_settings (provider_id, enabled, priority, updated_by, updated_at)
  values (p_provider_id, p_enabled, p_priority, auth.uid(), now())
  on conflict (provider_id)
  do update set enabled = p_enabled, priority = p_priority, updated_by = auth.uid(), updated_at = now();
end;
$$;

revoke execute on function public.admin_set_platform_provider_setting(text, boolean, int) from public;
revoke execute on function public.admin_set_platform_provider_setting(text, boolean, int) from anon;
grant execute on function public.admin_set_platform_provider_setting(text, boolean, int) to authenticated;

-- ---------------------------------------------------------------------
-- admin_ai_usage_summary — bridges ai_requests' own-row-only RLS
-- (0006_ai_governance.sql) the same way admin_list_users bridges
-- profiles/beta_invites. Fixes a real defect found this phase: the v1
-- Admin Dashboard's "AI requests (recent)"/"Recent AI errors" tiles
-- read ai_requests directly under RLS, so they silently showed only the
-- founder's OWN chat activity, not the platform's. Aggregates only —
-- no per-user row contents beyond what admin_list_users already exposes.
-- ---------------------------------------------------------------------

create or replace function public.admin_ai_usage_summary(p_since timestamptz default now() - interval '7 days')
returns table (
  provider text,
  request_count bigint,
  error_count bigint,
  avg_latency_ms numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select
      r.provider,
      count(*)::bigint,
      count(*) filter (where r.status = 'error')::bigint,
      avg(r.latency_ms)::numeric
    from public.ai_requests r
    where r.created_at >= p_since
      and r.feature <> 'provider-test'
    group by r.provider
    order by count(*) desc;
end;
$$;

revoke execute on function public.admin_ai_usage_summary(timestamptz) from public;
revoke execute on function public.admin_ai_usage_summary(timestamptz) from anon;
grant execute on function public.admin_ai_usage_summary(timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- admin_platform_counts — the Overview dashboard's "Knowledge" cards
-- (Documents/Conversations/Notes/Collections) need platform-wide counts;
-- all four tables are owner-scoped RLS, so a direct client count() would
-- also silently return only the founder's own rows. Returns aggregate
-- counts only, never row contents.
-- ---------------------------------------------------------------------

create or replace function public.admin_platform_counts()
returns table (
  documents bigint,
  conversations bigint,
  notes bigint,
  knowledge_collections bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select
      (select count(*) from public.documents),
      (select count(*) from public.conversations),
      (select count(*) from public.notes),
      (select count(*) from public.knowledge_collections);
end;
$$;

revoke execute on function public.admin_platform_counts() from public;
revoke execute on function public.admin_platform_counts() from anon;
grant execute on function public.admin_platform_counts() to authenticated;

-- ---------------------------------------------------------------------
-- Defense-in-depth finding from this phase's own security review: this
-- project has ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON
-- FUNCTIONS TO anon, authenticated (confirmed via pg_default_acl) — a
-- project-level default that grants EXECUTE directly to `anon`, not
-- merely through the PUBLIC pseudo-role. `revoke ... from public` alone
-- (the pattern every admin function up to and including this migration
-- used) never actually removed anon's grant, for any function ever
-- created in this project. In every case the internal
-- is_platform_admin() check still rejects an unauthenticated caller
-- (auth.uid() is null for anon, so the exists() check is false) — this
-- was never an authorization bypass — but "restricted execution
-- privileges" should mean what it says. Explicit anon revokes above
-- close it for every function this migration creates; this block closes
-- the same gap for the admin-authorization functions the prior phase
-- (0035_platform_admin_foundation.sql) shipped (admin_list_users is
-- covered by its own drop/recreate above, not repeated here) — scoped
-- to exactly these — not to is_beta_invited (deliberately anon-callable
-- for pre-signup checks) or to trigger-only functions nothing calls via RPC.
-- ---------------------------------------------------------------------

revoke execute on function public.is_platform_admin(uuid) from anon;
revoke execute on function public.admin_list_beta_invites() from anon;
revoke execute on function public.admin_create_beta_invite(text, text, text, uuid) from anon;
revoke execute on function public.admin_revoke_beta_invite(uuid) from anon;

-- ---------------------------------------------------------------------
-- admin_update_plan_quota — Plan Management's "modify quota limits."
-- Updates only the limit on an existing plan_quotas row (never creates a
-- new quota_key, never touches quota_usage) — a founder tuning a known
-- knob, not defining new plan shape.
-- ---------------------------------------------------------------------

create or replace function public.admin_update_plan_quota(p_plan_id uuid, p_quota_key text, p_quota_limit bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if p_quota_limit < 0 then
    raise exception 'Quota limit cannot be negative';
  end if;

  update public.plan_quotas
  set quota_limit = p_quota_limit
  where plan_id = p_plan_id and quota_key = p_quota_key;

  if not found then
    raise exception 'No quota row for that plan/quota_key';
  end if;
end;
$$;

revoke execute on function public.admin_update_plan_quota(uuid, text, bigint) from public;
revoke execute on function public.admin_update_plan_quota(uuid, text, bigint) from anon;
grant execute on function public.admin_update_plan_quota(uuid, text, bigint) to authenticated;
