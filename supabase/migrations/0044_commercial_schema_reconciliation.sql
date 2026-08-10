-- Phase 4 Commercial Architecture — Commercial Schema Reconciliation.
--
-- `plans`/`plan_quotas`/`user_plan_assignments`/`quota_usage` (and
-- `beta_invites`, a direct dependency of `assign_default_plan` below)
-- have never had a `CREATE TABLE` statement in migration history —
-- confirmed by direct inspection of the live project
-- (uzshazetfkjkrdnxwjtl) on 2026-08-10: exact columns, defaults,
-- constraints, indexes, RLS policies, and function bodies were pulled
-- from `information_schema`/`pg_catalog` and are reproduced verbatim
-- below via `CREATE TABLE IF NOT EXISTS`, so applying this against the
-- live database is a documented no-op for structure (the tables already
-- exist and already match this DDL exactly) while making the repo's
-- migration history match reality going forward. This mirrors the exact
-- precedent of 0034_beta_invite_quota_repair.sql, which reconciled RLS
-- and functions for these same tables without ever having codified the
-- table DDL itself — that remaining gap is what this migration closes.
--
-- Nothing here changes data, drops anything, or alters entitlement
-- behavior. Two small, deliberate hardening additions are bundled in
-- (both zero-behavior-change, both directly serving "make this
-- reproducible and safe before billing depends on it"):
--
-- 1. `assign_default_plan()` was missing `SET search_path TO 'public'`
--    (present on every sibling SECURITY DEFINER function in this same
--    system — enforce_beta_invite_gate, is_beta_invited, handle_new_user,
--    resolve_effective_quota_limit, consume_quota, every admin_* RPC).
--    This closes the exact `function_search_path_mutable` advisory
--    finding already flagged for this function by Supabase's own
--    linter in the Phase 3 security audit. Adding it cannot change
--    behavior — search_path only affects unqualified identifier
--    resolution, and every identifier in this function's body is
--    already schema-qualified (`public.beta_invites`, etc.) except the
--    two `new.*` trigger-record fields, which aren't affected by
--    search_path at all.
--
-- 2. `plans`/`plan_quotas`/`user_plan_assignments`/`quota_usage` and
--    `beta_invites` all still carry the project-level default
--    INSERT/UPDATE/DELETE/TRUNCATE table grants to `anon` and
--    `authenticated` documented as a known issue in
--    0042_tighten_beta_quota_function_grants.sql (there, for function
--    EXECUTE grants; here, the table-grant analog of the same root
--    cause). RLS already blocks every one of these operations today —
--    each table has exactly one SELECT policy and zero write policies,
--    so no write grant is actually usable by anon/authenticated
--    regardless of the underlying GRANT — but leaving an unusable grant
--    in place is exactly the kind of latent gap billing-adjacent tables
--    shouldn't carry forward. Revoking it is behavior-neutral (RLS was
--    already the enforcement point) and closes the same class of issue
--    0042 closed for functions.

-- ---------------------------------------------------------------------
-- plans (created first — beta_invites/plan_quotas/user_plan_assignments
-- below all carry a foreign key to it, so table order matters for a
-- from-scratch apply even though every CREATE TABLE in this file is a
-- documented no-op against the current live database, where all five
-- tables already exist).
-- ---------------------------------------------------------------------

create table if not exists public.plans (
  id uuid not null default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint plans_pkey primary key (id),
  constraint plans_code_key unique (code)
);

-- ---------------------------------------------------------------------
-- plan_quotas
-- ---------------------------------------------------------------------

create table if not exists public.plan_quotas (
  id uuid not null default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  quota_key text not null,
  quota_limit bigint not null,
  quota_period text not null default 'monthly',
  created_at timestamptz not null default now(),
  constraint plan_quotas_pkey primary key (id),
  constraint plan_quotas_plan_id_quota_key_key unique (plan_id, quota_key)
);

-- ---------------------------------------------------------------------
-- beta_invites (dependency of assign_default_plan; also untracked)
-- ---------------------------------------------------------------------

create table if not exists public.beta_invites (
  id uuid not null default gen_random_uuid(),
  email text not null default '',
  status text not null default 'invited',
  full_name text,
  organization text,
  invited_by text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  plan_id uuid references public.plans(id),
  accepted_by uuid references auth.users(id),
  constraint beta_invites_pkey primary key (id, email, status),
  constraint beta_invites_email_key unique (email),
  constraint beta_invites_status_check check (status = any (array['invited', 'accepted']))
);

create unique index if not exists beta_invites_email_lower_idx
  on public.beta_invites (lower(email));

-- ---------------------------------------------------------------------
-- user_plan_assignments
-- ---------------------------------------------------------------------

create table if not exists public.user_plan_assignments (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint user_plan_assignments_pkey primary key (id)
);

create unique index if not exists user_plan_assignments_one_active_idx
  on public.user_plan_assignments (user_id)
  where active;

-- ---------------------------------------------------------------------
-- quota_usage
-- ---------------------------------------------------------------------

create table if not exists public.quota_usage (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quota_key text not null,
  usage_count bigint not null default 0,
  period_start timestamptz not null default date_trunc('month', now()),
  period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quota_usage_pkey primary key (id),
  constraint quota_usage_user_id_quota_key_period_start_key unique (user_id, quota_key, period_start)
);

-- ---------------------------------------------------------------------
-- RLS (already enabled/policied live; reproduced here so migration
-- history matches reality — DROP IF EXISTS + CREATE is idempotent and
-- matches the exact precedent in 0034).
-- ---------------------------------------------------------------------

alter table public.beta_invites enable row level security;
alter table public.plans enable row level security;
alter table public.plan_quotas enable row level security;
alter table public.user_plan_assignments enable row level security;
alter table public.quota_usage enable row level security;

drop policy if exists "Authenticated users can view plans" on public.plans;
create policy "Authenticated users can view plans"
  on public.plans for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can view plan quotas" on public.plan_quotas;
create policy "Authenticated users can view plan quotas"
  on public.plan_quotas for select
  to authenticated
  using (true);

drop policy if exists "Users can view their own plan assignment" on public.user_plan_assignments;
create policy "Users can view their own plan assignment"
  on public.user_plan_assignments for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own quota usage" on public.quota_usage;
create policy "Users can view their own quota usage"
  on public.quota_usage for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- beta_invites intentionally has zero client policies (matches live
-- state exactly) — the only access paths are is_beta_invited() (anon
-- RPC), assign_default_plan() (trigger), and the admin_* beta RPCs.

-- ---------------------------------------------------------------------
-- Hardening addition 2: revoke unusable write grants (RLS was already
-- the real enforcement point; this closes the latent grant gap).
-- ---------------------------------------------------------------------

revoke insert, update, delete, truncate on public.beta_invites from anon, authenticated;
revoke select, insert, update, delete, truncate on public.plans from anon;
revoke insert, update, delete, truncate on public.plans from authenticated;
revoke select, insert, update, delete, truncate on public.plan_quotas from anon;
revoke insert, update, delete, truncate on public.plan_quotas from authenticated;
revoke select, insert, update, delete, truncate on public.user_plan_assignments from anon;
revoke insert, update, delete, truncate on public.user_plan_assignments from authenticated;
revoke select, insert, update, delete, truncate on public.quota_usage from anon;
revoke insert, update, delete, truncate on public.quota_usage from authenticated;

-- ---------------------------------------------------------------------
-- assign_default_plan() — codified verbatim from the live function body,
-- plus hardening addition 1 (SET search_path). AFTER INSERT on
-- auth.users; resolves the accepted invite's plan_id, falls back to the
-- 'beta' plan, seeds quota_usage counters, marks the invite accepted.
-- ---------------------------------------------------------------------

create or replace function public.assign_default_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    invited_plan_id uuid;
begin
    -- Look up the plan attached to the invitation
    select bi.plan_id
    into invited_plan_id
    from public.beta_invites bi
    where lower(bi.email) = lower(new.email)
      and bi.status = 'invited'
    limit 1;

    -- Fall back to Beta if no invitation plan exists
    if invited_plan_id is null then
        select id
        into invited_plan_id
        from public.plans
        where code = 'beta';
    end if;

    -- Assign the user's plan
    insert into public.user_plan_assignments (
        user_id,
        plan_id,
        active
    )
    values (
        new.id,
        invited_plan_id,
        true
    );

    -- Initialize quota counters
    insert into public.quota_usage (
        user_id,
        quota_key,
        usage_count
    )
    select
        new.id,
        pq.quota_key,
        0
    from public.plan_quotas pq
    where pq.plan_id = invited_plan_id
    on conflict do nothing;

    -- Mark the invitation as accepted
    update public.beta_invites
    set
        status = 'accepted',
        accepted_at = now(),
        accepted_by = new.id
    where lower(email) = lower(new.email)
      and status = 'invited';

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_assign_plan on auth.users;

create trigger on_auth_user_created_assign_plan
  after insert on auth.users
  for each row execute function public.assign_default_plan();

-- assign_default_plan is a trigger function (references `new`) — it has
-- no legitimate direct-call path at all (a bare RPC call errors outside
-- trigger context, and Postgres invokes it via the trigger mechanism
-- regardless of any EXECUTE grant). Revoke the latent client grants
-- entirely, matching the discipline 0042 already applied to
-- enforce_beta_invite_gate/consume_quota.
revoke execute on function public.assign_default_plan() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- is_beta_invited() — codified verbatim; already correct (anon-callable
-- by design, for the pre-signup client check; already has search_path
-- set). No changes, reproduced here purely for migration-tracking.
-- ---------------------------------------------------------------------

create or replace function public.is_beta_invited(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.beta_invites
        where lower(email) = lower(check_email)
          and status = 'invited'
    );
$$;
