-- Founding Pro Programme — Phase 1: database foundation and lifecycle
-- model ONLY. No PricingPage/application UI/admin UI/email flow — those
-- are later phases, explicitly excluded from this migration.
--
-- Reuses, unmodified: the existing `founding_pro` plans row
-- (0045_founding_pro_plan.sql) as the entitlement target,
-- `user_plan_assignments`/`resolve_effective_quota_limit`/`has_feature`
-- as the entitlement mechanism (zero changes — a member's founding_pro
-- assignment grants full Pro capability the instant it's active, exactly
-- like every other plan), `admin_change_user_plan()` as the literal
-- assignment call inside the new enrollment RPC below, and
-- `is_platform_admin()` as the authorization primitive every new
-- SECURITY DEFINER function here re-checks internally, matching every
-- prior admin_* RPC in this codebase.
--
-- Four new tables, all additive, none touching Beta/Pro/existing
-- commercial data:
--
--   founding_pro_applications — customer-initiated, admin-reviewed.
--     No precedent existed for this direction (beta_invites is
--     admin-push only) — this is the one genuinely new lifecycle entity
--     the program needs. No client INSERT/UPDATE policy and no
--     application-submission RPC are added in this phase (explicitly
--     out of scope — "do not build that UI or RPC unless strictly
--     required for the schema"); only the schema + an own-row SELECT
--     policy exist today, so a future phase can add the submission path
--     without another migration touching this table's shape.
--
--   founding_pro_members — the permanent record. Deliberately separate
--     from user_plan_assignments (which only ever tracks a user's
--     *current* plan and deactivates history rows) because "member #42,
--     enrolled <date>, at $X/mo, expiring <date>" must survive even
--     after a later transition to ordinary Pro changes the active
--     user_plan_assignments row. unique(user_id): a user can only ever
--     hold one founding record, forever.
--
--   founding_pro_capacity — a single locked counter row (id=1, enforced
--     by a CHECK), the entire concurrency boundary for the 100-slot cap.
--     `SELECT ... FOR UPDATE` on this one row inside
--     admin_enroll_founding_pro_member is what makes "two admins
--     approving simultaneously" impossible to race — the second
--     transaction blocks on the row lock until the first commits or
--     rolls back, never a bare "count then insert."
--
--   founding_pro_events — append-only audit trail. subscription_events
--     (0047) was considered and rejected as the reuse target: its shape
--     (provider/provider_event_id-keyed webhook idempotency ledger) is
--     billing-provider-specific, not a fit for "admin approved
--     application #14." This is a small, dedicated, genuinely
--     append-only table instead (enforced by trigger, not just
--     "no RPC exists to mutate it" — see below).
--
-- Public capacity is exposed through exactly one narrow, count-only
-- function (get_founding_pro_public_capacity) rather than a direct table
-- grant — founding_pro_capacity itself has zero client policies/grants
-- at all, so there is no path to ever accidentally leak more than the
-- three numbers that function returns.
--
-- The enrollment primitive (admin_enroll_founding_pro_member) is the
-- ONLY thing built this phase that mutates founding state: it reserves
-- a slot, assigns the permanent number, records the admin-supplied
-- founding price (never invented, never read from plans.monthly_price_
-- cents — see its own comment below), computes the 3-month expiry
-- server-side, grants entitlement via the existing admin_change_user_
-- plan(), marks the application enrolled, and writes one audit event —
-- all inside one transaction. Approve/reject RPCs and the expiry-
-- transition RPC are explicitly NOT built this phase (see this
-- migration's final report for why).

-- ---------------------------------------------------------------------
-- founding_pro_applications
-- ---------------------------------------------------------------------

create table public.founding_pro_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn', 'enrolled')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index founding_pro_applications_user_id_idx on public.founding_pro_applications (user_id);
create index founding_pro_applications_status_idx on public.founding_pro_applications (status);

-- Prevents a user from having more than one live application at a time
-- (pending or approved-but-not-yet-enrolled). A rejected or withdrawn
-- application does not block reapplying; an already-enrolled member is
-- separately blocked by founding_pro_members' own unique(user_id).
create unique index founding_pro_applications_one_active_per_user_idx
  on public.founding_pro_applications (user_id)
  where status in ('pending', 'approved');

alter table public.founding_pro_applications enable row level security;

create policy "Users can view their own founding pro application"
  on public.founding_pro_applications for select
  to authenticated
  using (auth.uid() = user_id);

-- No client write policy yet — deliberate. Application submission is a
-- later phase's RPC to design (server-resolves applicant identity from
-- auth.uid()/profiles rather than trusting client-supplied name/email,
-- consistent with every other write path in this codebase). Every
-- mutation today happens only inside admin_enroll_founding_pro_member
-- below (SECURITY DEFINER, bypasses RLS the same way apply_subscription_
-- event bypasses subscription_events' zero-policy RLS).
revoke insert, update, delete, truncate on public.founding_pro_applications from anon, authenticated;
revoke select, insert, update, delete, truncate on public.founding_pro_applications from anon;

-- ---------------------------------------------------------------------
-- founding_pro_members
-- ---------------------------------------------------------------------

create table public.founding_pro_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.founding_pro_applications(id),
  slot_type text not null check (slot_type in ('public', 'grandfathered')),
  -- NULL for grandfathered members on purpose: "Public Founding Pro
  -- members receive permanent founding member numbers 1-100" is a
  -- public-slot concept only. The CHECK below makes this a structural
  -- guarantee, not a convention: a public row is required to carry a
  -- number in range, a grandfathered row is required not to.
  founding_member_number int,
  -- Never defaulted, never derived from plans.monthly_price_cents —
  -- see admin_enroll_founding_pro_member's own comment for why. Recorded
  -- once at enrollment and never touched again by anything in this
  -- migration, so a later change to the programme's list price can never
  -- retroactively alter what an already-enrolled founder agreed to.
  founding_price_cents integer not null check (founding_price_cents >= 0),
  currency text not null default 'USD',
  founding_started_at timestamptz not null default now(),
  founding_expires_at timestamptz not null,
  transition_status text not null default 'active'
    check (transition_status in ('active', 'transitioned')),
  transitioned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint founding_pro_members_user_key unique (user_id),
  constraint founding_pro_members_number_slot_check check (
    (slot_type = 'public' and founding_member_number between 1 and 100)
    or (slot_type = 'grandfathered' and founding_member_number is null)
  ),
  constraint founding_pro_members_transition_check check (
    (transition_status = 'active' and transitioned_at is null)
    or (transition_status = 'transitioned' and transitioned_at is not null)
  )
);

-- The uniqueness half of "never duplicated" — combined with the row-lock
-- discipline in admin_enroll_founding_pro_member below, this is the
-- second, independent layer guaranteeing no two public members can ever
-- share a number (the lock prevents the race that could produce it; this
-- constraint means even a hypothetical bug in the lock logic could not
-- silently succeed in creating a duplicate).
create unique index founding_pro_members_public_number_idx
  on public.founding_pro_members (founding_member_number)
  where slot_type = 'public';

create index founding_pro_members_slot_type_idx on public.founding_pro_members (slot_type);
create index founding_pro_members_transition_status_idx on public.founding_pro_members (transition_status);
create index founding_pro_members_expires_at_idx on public.founding_pro_members (founding_expires_at);

alter table public.founding_pro_members enable row level security;

create policy "Users can view their own founding pro membership"
  on public.founding_pro_members for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.founding_pro_members from anon, authenticated;
revoke select, insert, update, delete, truncate on public.founding_pro_members from anon;

-- ---------------------------------------------------------------------
-- founding_pro_capacity — single-row, lockable counter. The id=1 CHECK
-- plus the single seeded row make it structurally a singleton: nothing
-- can ever insert a second capacity row, so `where id = 1` always
-- resolves to exactly the one row every enrollment locks against.
-- ---------------------------------------------------------------------

create table public.founding_pro_capacity (
  id smallint primary key default 1 check (id = 1),
  max_public_slots int not null default 100 check (max_public_slots > 0),
  enrolled_public_count int not null default 0 check (enrolled_public_count >= 0),
  updated_at timestamptz not null default now(),
  constraint founding_pro_capacity_within_max check (enrolled_public_count <= max_public_slots)
);

insert into public.founding_pro_capacity (id, max_public_slots, enrolled_public_count)
values (1, 100, 0)
on conflict (id) do nothing;

alter table public.founding_pro_capacity enable row level security;

-- Zero client policies/grants at all, deliberately — not even an
-- own-row concept applies here (it's a single global counter, not
-- per-user data). The only sanctioned read path is
-- get_founding_pro_public_capacity() below; the only writer is
-- admin_enroll_founding_pro_member's row-locked update.
revoke select, insert, update, delete, truncate on public.founding_pro_capacity from anon, authenticated;

-- ---------------------------------------------------------------------
-- founding_pro_events — append-only lifecycle audit trail. Genuinely
-- enforced, not just "no RPC exists to mutate it": the triggers below
-- reject UPDATE/DELETE unconditionally, at the table level, regardless
-- of which role or function attempts it — a future careless RPC cannot
-- silently break the append-only guarantee without this trigger firing.
-- ---------------------------------------------------------------------

create table public.founding_pro_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'application_submitted',
    'application_approved',
    'application_rejected',
    'application_withdrawn',
    'invitation_issued',
    'invitation_accepted',
    'member_enrolled',
    'member_grandfathered',
    'transition_completed',
    'admin_action'
  )),
  application_id uuid references public.founding_pro_applications(id),
  member_id uuid references public.founding_pro_members(id),
  actor_user_id uuid references auth.users(id),
  target_user_id uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index founding_pro_events_application_id_idx on public.founding_pro_events (application_id);
create index founding_pro_events_member_id_idx on public.founding_pro_events (member_id);
create index founding_pro_events_target_user_id_idx on public.founding_pro_events (target_user_id);
create index founding_pro_events_created_at_idx on public.founding_pro_events (created_at);

alter table public.founding_pro_events enable row level security;

-- Zero client policies — admin-only read via a future admin RPC (not
-- built this phase), matching subscription_events' own precedent
-- exactly. Writes happen only from inside admin_enroll_founding_pro_
-- member (SECURITY DEFINER, bypasses RLS the same way every other
-- admin_* write path does).
revoke select, insert, update, delete, truncate on public.founding_pro_events from anon, authenticated;

create or replace function public.prevent_founding_pro_events_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'founding_pro_events is append-only; % is not permitted', tg_op;
end;
$$;

create trigger founding_pro_events_no_update
  before update on public.founding_pro_events
  for each row execute function public.prevent_founding_pro_events_mutation();

create trigger founding_pro_events_no_delete
  before delete on public.founding_pro_events
  for each row execute function public.prevent_founding_pro_events_mutation();

-- ---------------------------------------------------------------------
-- get_founding_pro_public_capacity() — the one sanctioned public read
-- path. Returns only the three numbers a "63 of 100 places remaining"
-- indicator needs; founding_pro_capacity has no other client-reachable
-- read path (see above), so this function's own column list is the
-- entire public surface area — it structurally cannot leak applicant/
-- member identity or founding price, because it never selects from any
-- table that has those columns.
-- ---------------------------------------------------------------------

create or replace function public.get_founding_pro_public_capacity()
returns table (
  max_public_slots int,
  enrolled_public_count int,
  remaining_public_slots int
)
language sql
stable
security definer
set search_path = public
as $$
  select max_public_slots, enrolled_public_count, max_public_slots - enrolled_public_count
  from public.founding_pro_capacity
  where id = 1;
$$;

revoke execute on function public.get_founding_pro_public_capacity() from public;
grant execute on function public.get_founding_pro_public_capacity() to anon, authenticated;

-- ---------------------------------------------------------------------
-- admin_enroll_founding_pro_member — the one atomic enrollment
-- primitive this phase builds. Every step (capacity lock, number
-- assignment, member insert, entitlement grant, application update,
-- audit event) happens inside this single function body, i.e. one
-- Postgres transaction: if any step raises, everything before it in
-- this call rolls back too — there is no intermediate committed state
-- where a slot is consumed but no member row exists, or a member row
-- exists but entitlement was never granted.
--
-- Pricing: p_founding_price_cents/p_currency are REQUIRED admin-supplied
-- parameters, never read from plans.monthly_price_cents and never
-- defaulted — the mandate is "do not invent a price; fail safely if one
-- is required." A NULL or negative value raises immediately, before any
-- state is touched. This is intentionally the *only* place in the whole
-- programme a price is decided per member — plans.monthly_price_cents
-- remains what it always was (ordinary Pro's price), untouched by this
-- migration, so a future change to it can never retroactively alter an
-- already-enrolled founder's recorded terms.
--
-- Concurrency: `select ... from founding_pro_capacity where id = 1 for
-- update` is the entire safety mechanism for the 100-slot cap. Two
-- admins calling this function for two different applications at the
-- same instant: whichever transaction acquires the row lock first
-- proceeds to compute next_number and commit; the second blocks at the
-- FOR UPDATE line until the first's transaction ends, then re-reads the
-- now-updated enrolled_public_count and either gets the correct next
-- number or correctly hits the capacity-full exception if the first
-- transaction filled the last slot. No window exists where both read
-- the same "99 enrolled" state and both compute "100" — the second
-- literally cannot proceed until the first is done.
-- ---------------------------------------------------------------------

create or replace function public.admin_enroll_founding_pro_member(
  p_application_id uuid,
  p_slot_type text,
  p_founding_price_cents integer,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.founding_pro_applications;
  v_founding_plan_id uuid;
  v_capacity public.founding_pro_capacity;
  v_next_number int;
  v_member_id uuid;
  v_started_at timestamptz := now();
  v_expires_at timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if p_slot_type not in ('public', 'grandfathered') then
    raise exception 'Invalid slot_type: % (must be public or grandfathered)', p_slot_type;
  end if;

  if p_founding_price_cents is null or p_founding_price_cents < 0 then
    raise exception 'A valid founding price (in cents) must be supplied to enroll a member — it is never invented or defaulted server-side';
  end if;

  if p_currency is null or length(trim(p_currency)) = 0 then
    raise exception 'A currency must be supplied to enroll a member';
  end if;

  select * into v_application from public.founding_pro_applications where id = p_application_id for update;
  if v_application.id is null then
    raise exception 'Application not found';
  end if;
  if v_application.status <> 'approved' then
    raise exception 'Application must be approved before enrollment (current status: %)', v_application.status;
  end if;

  if exists (select 1 from public.founding_pro_members where user_id = v_application.user_id) then
    raise exception 'User already has a Founding Pro membership record';
  end if;

  select id into v_founding_plan_id from public.plans where code = 'founding_pro';
  if v_founding_plan_id is null then
    raise exception 'founding_pro plan is not configured';
  end if;

  v_expires_at := v_started_at + interval '3 months';

  if p_slot_type = 'public' then
    select * into v_capacity from public.founding_pro_capacity where id = 1 for update;

    if v_capacity.enrolled_public_count >= v_capacity.max_public_slots then
      raise exception 'Founding Pro public capacity is full (% of % public slots enrolled)', v_capacity.enrolled_public_count, v_capacity.max_public_slots;
    end if;

    v_next_number := v_capacity.enrolled_public_count + 1;

    update public.founding_pro_capacity
    set enrolled_public_count = v_next_number, updated_at = now()
    where id = 1;
  else
    v_next_number := null;
  end if;

  insert into public.founding_pro_members (
    user_id, application_id, slot_type, founding_member_number,
    founding_price_cents, currency, founding_started_at, founding_expires_at
  )
  values (
    v_application.user_id, v_application.id, p_slot_type, v_next_number,
    p_founding_price_cents, p_currency, v_started_at, v_expires_at
  )
  returning id into v_member_id;

  -- Grant entitlement through the existing, unmodified plan-assignment
  -- mechanism — no parallel entitlement path invented. The instant this
  -- returns, resolve_effective_quota_limit/has_feature already see the
  -- user as founding_pro, exactly like any other plan change.
  perform public.admin_change_user_plan(v_application.user_id, v_founding_plan_id);

  update public.founding_pro_applications
  set status = 'enrolled', reviewed_at = coalesce(reviewed_at, now())
  where id = v_application.id;

  insert into public.founding_pro_events (event_type, application_id, member_id, actor_user_id, target_user_id, metadata)
  values (
    case when p_slot_type = 'public' then 'member_enrolled' else 'member_grandfathered' end,
    v_application.id,
    v_member_id,
    auth.uid(),
    v_application.user_id,
    jsonb_build_object(
      'slot_type', p_slot_type,
      'founding_member_number', v_next_number,
      'founding_price_cents', p_founding_price_cents,
      'currency', p_currency,
      'founding_started_at', v_started_at,
      'founding_expires_at', v_expires_at
    )
  );

  return jsonb_build_object(
    'outcome', 'enrolled',
    'member_id', v_member_id,
    'founding_member_number', v_next_number,
    'slot_type', p_slot_type,
    'founding_started_at', v_started_at,
    'founding_expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.admin_enroll_founding_pro_member(uuid, text, integer, text) from public, anon;
grant execute on function public.admin_enroll_founding_pro_member(uuid, text, integer, text) to authenticated;
