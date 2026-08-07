-- Beta Invite + Quota System Reconciliation & Repair.
--
-- `beta_invites`/`plans`/`plan_quotas`/`user_plan_assignments`/
-- `quota_usage` and the functions `is_beta_invited`/`assign_default_plan`
-- were created manually in the Supabase dashboard, outside migration
-- tracking entirely (confirmed: no prior migration file or remote
-- migration-ledger entry mentions any of them). This migration captures
-- the live schema going forward and repairs four confirmed defects found
-- by direct inspection of the live database — nothing here is a redesign
-- of the manual work, and nothing drops or resets existing data.
--
-- Defect 1 — beta_invites.status's column default decodes to the
-- 9-character string `'invited'` (literal embedded quote characters),
-- not the clean 7-character `invited` that `is_beta_invited()` and
-- `assign_default_plan()` compare against. Confirmed directly:
-- `select length('''invited'''::text)` = 9. Any row relying on the
-- default instead of an explicit value silently fails the beta gate.
--
-- Defect 2 — no case-insensitive uniqueness on beta_invites.email (only
-- a case-sensitive UNIQUE), so "Dan@x.com" and "dan@x.com" could exist
-- as two separate invite rows.
--
-- Defect 3 — the beta gate is entirely client-side
-- (AuthContext.signUpWithPassword checks is_beta_invited() before
-- calling auth.signUp()) — nothing stops a direct auth.signUp() or
-- signInWithOtp() call (which can auto-create a user) from bypassing it
-- server-side.
--
-- Defect 4 — plans/plan_quotas/user_plan_assignments/quota_usage have
-- RLS disabled entirely, with full CRUD grants to anon+authenticated
-- (flagged critical by Supabase's own advisor). Any authenticated (or
-- anonymous) client can currently rewrite their own plan assignment,
-- their own quota usage, or — since plan_quotas isn't user-scoped —
-- the global quota limits for every user on the platform.
--
-- Also fixed in the same pass: quotaService.ts's quota_usage
-- reads/writes never filtered by period_start despite the table being
-- period-aware (UNIQUE(user_id, quota_key, period_start) already
-- exists), and the increment was a non-atomic select-then-update/insert
-- (lost-update race). Both fixed by routing writes through the new
-- consume_quota() RPC below and adding a period filter to the
-- application's read path (see src/shared/lib/quotaService.ts).

-- ---------------------------------------------------------------------
-- Defect 1: status default + guard against the same corruption recurring
-- ---------------------------------------------------------------------

alter table public.beta_invites
  alter column status set default 'invited';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.beta_invites'::regclass
      and conname = 'beta_invites_status_check'
  ) then
    alter table public.beta_invites
      add constraint beta_invites_status_check
      check (status in ('invited', 'accepted'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Defect 2: case-insensitive email uniqueness
-- ---------------------------------------------------------------------

create unique index if not exists beta_invites_email_lower_idx
  on public.beta_invites (lower(email));

-- ---------------------------------------------------------------------
-- Defect 3: server-side signup gate. BEFORE INSERT (not AFTER, like the
-- existing handle_new_user/assign_default_plan) so it can actually abort
-- the row — this is the only enforcement point that covers every
-- account-creation path uniformly (password signup, magic-link
-- auto-create, admin-created users), unlike the client-side check.
-- ---------------------------------------------------------------------

create or replace function public.enforce_beta_invite_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.beta_invites
    where lower(email) = lower(new.email)
      and status = 'invited'
  ) then
    raise exception 'This email is not approved for beta access.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_beta_invite_gate_before_insert on auth.users;

create trigger enforce_beta_invite_gate_before_insert
  before insert on auth.users
  for each row execute function public.enforce_beta_invite_gate();

-- ---------------------------------------------------------------------
-- Defect 4: RLS. Plan catalog is public-read-only for authenticated
-- users; a user's own assignment/usage rows are read-only for that user;
-- no write policies at all — every write goes through a
-- SECURITY DEFINER function (assign_default_plan, already existing;
-- consume_quota, added below), which is exempt from RLS as the table
-- owner, exactly like handle_new_user/assign_default_plan already rely
-- on today for beta_invites/profiles/workspace_members.
-- ---------------------------------------------------------------------

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
  using (auth.uid() = user_id);

drop policy if exists "Users can view their own quota usage" on public.quota_usage;
create policy "Users can view their own quota usage"
  on public.quota_usage for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- consume_quota RPC — the only write path left for quota_usage now that
-- RLS blocks direct client writes. Atomic upsert-increment scoped to the
-- current calendar-month period, fixing the two application-level bugs
-- described above in one motion. Resolves the caller's plan via
-- auth.uid() (not a client-supplied user id) so it can't be used to
-- attribute usage to a different user.
-- ---------------------------------------------------------------------

create or replace function public.consume_quota(p_quota_key text)
returns table (usage_count bigint, quota_limit bigint, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_limit bigint;
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_count bigint;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select plan_id into v_plan_id
  from public.user_plan_assignments
  where user_id = v_user_id and active = true
  limit 1;

  if v_plan_id is null then
    return query select 0::bigint, 0::bigint, false;
    return;
  end if;

  select pq.quota_limit into v_limit
  from public.plan_quotas pq
  where pq.plan_id = v_plan_id and pq.quota_key = p_quota_key;

  if v_limit is null then
    return query select 0::bigint, 0::bigint, false;
    return;
  end if;

  insert into public.quota_usage (user_id, quota_key, usage_count, period_start, period_end)
  values (v_user_id, p_quota_key, 1, v_period_start, v_period_end)
  on conflict (user_id, quota_key, period_start)
  do update set usage_count = quota_usage.usage_count + 1, updated_at = now()
  returning quota_usage.usage_count into v_count;

  return query select v_count, v_limit, (v_count <= v_limit);
end;
$$;

grant execute on function public.consume_quota(text) to authenticated;
