-- Founding Pro Programme — Phase 4: invitation & self-service atomic
-- enrollment. Reuses, unmodified: founding_pro_applications/_members/
-- _capacity/_events (0052), the Phase 3 admin approve/reject RPCs (0054),
-- is_platform_admin() (0035), and the existing invitation-lifecycle
-- precedent (workspace_invitations/respond_to_workspace_invitation,
-- 0030/0032) for the "known-account, identity-authorized acceptance, no
-- secret token" design this migration follows.
--
-- Lifecycle design decision: application.status is NOT extended with
-- 'invited'/'accepted' values. founding_pro_applications' own CHECK
-- constraint and its one-active-per-user partial unique index
-- (`where status in ('pending','approved')`), plus every existing
-- Phase 1/3 guard (`if v_application.status <> 'approved'`,
-- `if v_app.status <> 'pending'`), are already live-tested invariants
-- this migration must not touch. Instead — exactly the precedent
-- workspace_invitations already set by staying a separate table rather
-- than overloading workspace_members.status — invitation state lives in
-- a new, dedicated `founding_pro_invitations` table with its own status
-- ('pending'/'accepted'/'revoked'). An application's displayed lifecycle
-- stage (Approved -> Invitation Sent -> Accepted -> Enrolled) is derived
-- by the admin list RPC joining the two tables, not stored as a single
-- flattened status column anywhere.
--
-- Acceptance security design: no secret token is minted or emailed.
-- Authorization is entirely `founding_pro_invitations.user_id =
-- auth.uid()`, mirroring respond_to_workspace_invitation's
-- `where id = target_membership_id and user_id = auth.uid()` exactly —
-- the invitee is already an authenticated ARRIYIA user (they could only
-- have an application at all by applying while signed in, Phase 2), so
-- there is no "unknown email" case to bridge with a token the way
-- workspace_invitations' unknown-account path needs one. Consequently
-- there is structurally no invitation secret that could ever leak
-- through an admin list response (security requirement #11) — there
-- isn't one to leak.
--
-- Pricing design decision: admin_enroll_founding_pro_member has always
-- required an admin-supplied price, never invented, never read from
-- plans.monthly_price_cents (0052's own comment). Phase 4 introduces a
-- moment — invitation acceptance — where enrollment happens without an
-- admin literally present, so the price decision necessarily moves
-- earlier: `admin_invite_founding_pro_member` requires the admin to
-- supply founding_price_cents/currency when the invitation is SENT, and
-- that value is stored immutably on the invitation row. Acceptance later
-- reads it back and passes it straight through — it is never re-decided,
-- re-derived, or accepted as client input at accept time. This is the
-- smallest change consistent with "do not redesign the pricing model."
--
-- Enrollment design decision (the part requiring the most care): the
-- task requires acceptance to "ultimately use the existing Phase 1
-- atomic enrollment mechanism" and forbids "a second competing
-- enrollment implementation." But admin_enroll_founding_pro_member (and
-- the admin_change_user_plan it calls) each independently re-check
-- is_platform_admin() via auth.uid() — and auth.uid() reflects the real
-- calling session's JWT regardless of SECURITY DEFINER nesting, so it is
-- NOT admin-shaped when the caller is the invited applicant accepting
-- their own invitation. Calling admin_enroll_founding_pro_member directly
-- from a self-service accept path would therefore always raise "Not
-- authorized," and there is no safe way to relax that check without
-- weakening the function every other admin caller already relies on.
-- The resolution: the transactional body (capacity lock, slot/number
-- allocation, member insert, entitlement assignment, application
-- transition, audit event) is factored ONCE into
-- `founding_pro_enroll_member_core`, which performs NO authorization
-- check of its own and is granted to nobody (`revoke all ... from
-- public, anon, authenticated` — completely unreachable via
-- `supabase.rpc(...)` from any client, admin or not). Both
-- admin_enroll_founding_pro_member (unchanged signature/behavior, still
-- admin-gated) and the new accept_founding_pro_invitation (gated by
-- invitation ownership) perform their OWN appropriate authorization
-- check first, then delegate to that single shared core — one
-- enrollment implementation, two independently-authorized entry points.
-- The plan-assignment step inside the core inlines
-- admin_change_user_plan's own two SQL statements directly (rather than
-- calling that admin-gated public RPC, which would hit the exact same
-- auth.uid()-is-not-an-admin problem) — this is not a second
-- entitlement-assignment mechanism, it is the same two statements,
-- located where both authorized entry points can actually reach them.
--
-- Concurrency: accept_founding_pro_invitation locks its own invitation
-- row (`for update`) before delegating, so two concurrent accept calls
-- for the same invitation can't race — the second blocks until the
-- first commits, then re-reads a no-longer-'pending' row and correctly
-- finds nothing to accept. The shared core still independently locks the
-- application row and (for public slots) the capacity row exactly as
-- Phase 1 always did, so the 100-slot cap remains race-proof regardless
-- of which entry point is used.

-- ---------------------------------------------------------------------
-- founding_pro_invitations
-- ---------------------------------------------------------------------

create table public.founding_pro_invitations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.founding_pro_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  -- Immutable once set — see this migration's header on pricing. Never
  -- updated after insert by any function in this migration.
  founding_price_cents integer not null check (founding_price_cents >= 0),
  currency text not null default 'USD',
  invited_at timestamptz not null default now(),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index founding_pro_invitations_application_id_idx on public.founding_pro_invitations (application_id);
create index founding_pro_invitations_user_id_idx on public.founding_pro_invitations (user_id);
create index founding_pro_invitations_status_idx on public.founding_pro_invitations (status);

-- At most one active (pending) invitation per application — "Prevent
-- duplicate active invitations" enforced structurally, mirroring
-- founding_pro_applications_one_active_per_user_idx's own precedent, not
-- left to application code alone.
create unique index founding_pro_invitations_pending_unique
  on public.founding_pro_invitations (application_id)
  where status = 'pending';

create trigger set_founding_pro_invitations_updated_at
  before update on public.founding_pro_invitations
  for each row execute function public.set_updated_at();

alter table public.founding_pro_invitations enable row level security;

-- Own-row read only, same shape as founding_pro_applications/_members'
-- existing SELECT policies — this is what lets the acceptance page read
-- "do I have a pending invitation, and at what price" via a plain client
-- select, no RPC needed for that read.
create policy "Users can view their own founding pro invitation"
  on public.founding_pro_invitations for select
  to authenticated
  using (auth.uid() = user_id);

-- No client write policy at all — every write happens inside
-- admin_invite_founding_pro_member / accept_founding_pro_invitation
-- below (SECURITY DEFINER, bypasses RLS the same way every other
-- founding_pro_* mutator already does).
revoke insert, update, delete, truncate on public.founding_pro_invitations from anon, authenticated;
revoke select, insert, update, delete, truncate on public.founding_pro_invitations from anon;

-- ---------------------------------------------------------------------
-- founding_pro_enroll_member_core — the one enrollment transaction body,
-- extracted verbatim from admin_enroll_founding_pro_member (0052) with
-- two changes: no is_platform_admin() check (moved to callers) and
-- auth.uid() replaced by an explicit p_actor_user_id parameter (so the
-- audit event correctly attributes either the acting admin or the
-- self-accepting member, depending on which entry point called it).
-- Granted to nobody — reachable only by function-to-function calls from
-- the two authorized entry points below, which run as this migration's
-- owning role regardless of the original caller's own grants.
-- ---------------------------------------------------------------------

create or replace function public.founding_pro_enroll_member_core(
  p_application_id uuid,
  p_slot_type text,
  p_founding_price_cents integer,
  p_currency text,
  p_actor_user_id uuid
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

  -- Inlined plan assignment (the same two statements
  -- admin_change_user_plan performs) rather than calling that admin-
  -- gated public RPC — see this migration's header for why. No parallel
  -- entitlement mechanism: this is the exact same write shape
  -- resolve_effective_quota_limit/has_feature already expect.
  update public.user_plan_assignments
  set active = false, ends_at = now()
  where user_id = v_application.user_id and active = true;

  insert into public.user_plan_assignments (user_id, plan_id, active)
  values (v_application.user_id, v_founding_plan_id, true);

  update public.founding_pro_applications
  set status = 'enrolled', reviewed_at = coalesce(reviewed_at, now())
  where id = v_application.id;

  insert into public.founding_pro_events (event_type, application_id, member_id, actor_user_id, target_user_id, metadata)
  values (
    case when p_slot_type = 'public' then 'member_enrolled' else 'member_grandfathered' end,
    v_application.id,
    v_member_id,
    p_actor_user_id,
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

revoke all on function public.founding_pro_enroll_member_core(uuid, text, integer, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- admin_enroll_founding_pro_member — unchanged external signature and
-- behavior (still the only entry point for a manual/grandfathered admin
-- enrollment). Body reduced to: authorize, then delegate to the shared
-- core with the acting admin as actor.
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
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return public.founding_pro_enroll_member_core(p_application_id, p_slot_type, p_founding_price_cents, p_currency, auth.uid());
end;
$$;

revoke all on function public.admin_enroll_founding_pro_member(uuid, text, integer, text) from public, anon;
grant execute on function public.admin_enroll_founding_pro_member(uuid, text, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- admin_invite_founding_pro_member — the admin action that sends an
-- invitation. Only an approved, not-yet-invited, not-yet-member
-- application is eligible. Locks the application row (same discipline
-- as Phase 3's approve/reject) so a concurrent approve/reject/invite
-- can't race this check.
-- ---------------------------------------------------------------------

create or replace function public.admin_invite_founding_pro_member(
  p_application_id uuid,
  p_founding_price_cents integer,
  p_currency text
)
returns public.founding_pro_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_application public.founding_pro_applications;
  v_invitation public.founding_pro_invitations;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if p_founding_price_cents is null or p_founding_price_cents < 0 then
    raise exception 'A valid founding price (in cents) must be supplied to invite a member — it is never invented or defaulted server-side';
  end if;

  if p_currency is null or length(trim(p_currency)) = 0 then
    raise exception 'A currency must be supplied to invite a member';
  end if;

  v_admin := auth.uid();

  select * into v_application from public.founding_pro_applications where id = p_application_id for update;
  if v_application.id is null then
    raise exception 'Application not found';
  end if;
  if v_application.status <> 'approved' then
    raise exception 'Application must be approved before an invitation can be sent (current status: %)', v_application.status;
  end if;

  if exists (select 1 from public.founding_pro_members where user_id = v_application.user_id) then
    raise exception 'This user already has a Founding Pro membership';
  end if;

  if exists (select 1 from public.founding_pro_invitations where application_id = p_application_id and status = 'pending') then
    raise exception 'An active invitation already exists for this application';
  end if;

  insert into public.founding_pro_invitations (application_id, user_id, status, founding_price_cents, currency, invited_by)
  values (p_application_id, v_application.user_id, 'pending', p_founding_price_cents, p_currency, v_admin)
  returning * into v_invitation;

  insert into public.founding_pro_events (event_type, application_id, actor_user_id, target_user_id, metadata)
  values (
    'invitation_issued',
    p_application_id,
    v_admin,
    v_application.user_id,
    jsonb_build_object('invitation_id', v_invitation.id, 'founding_price_cents', p_founding_price_cents, 'currency', p_currency)
  );

  return v_invitation;
end;
$$;

revoke all on function public.admin_invite_founding_pro_member(uuid, integer, text) from public, anon;
grant execute on function public.admin_invite_founding_pro_member(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- accept_founding_pro_invitation — the sole client-reachable acceptance
-- path. No arguments at all: the invitation is resolved entirely from
-- auth.uid(), so there is no invitation id, user id, price, or slot
-- type for a caller to supply or forge (security requirement "Do not
-- trust client-supplied user IDs, plan IDs, prices, or membership
-- numbers" is structurally true here — none of those are parameters).
-- Always enrolls as slot_type 'public': every application reaching this
-- path came through submit_founding_pro_application (Phase 2's public
-- applicant flow, 0053) — grandfathered enrollment remains an
-- admin-only path via admin_enroll_founding_pro_member, out of this
-- phase's scope (Beta grandfathering workflow, explicitly deferred).
-- ---------------------------------------------------------------------

create or replace function public.accept_founding_pro_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.founding_pro_invitations;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not authorized';
  end if;

  select * into v_invitation
  from public.founding_pro_invitations
  where user_id = v_uid and status = 'pending'
  for update;

  if v_invitation.id is null then
    raise exception 'No pending Founding Pro invitation found for this account';
  end if;

  v_result := public.founding_pro_enroll_member_core(
    v_invitation.application_id, 'public', v_invitation.founding_price_cents, v_invitation.currency, v_uid
  );

  update public.founding_pro_invitations
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = v_invitation.id;

  insert into public.founding_pro_events (event_type, application_id, member_id, actor_user_id, target_user_id, metadata)
  values (
    'invitation_accepted',
    v_invitation.application_id,
    (v_result->>'member_id')::uuid,
    v_uid,
    v_uid,
    jsonb_build_object('invitation_id', v_invitation.id)
  );

  return v_result;
end;
$$;

revoke all on function public.accept_founding_pro_invitation() from public, anon;
grant execute on function public.accept_founding_pro_invitation() to authenticated;

-- ---------------------------------------------------------------------
-- admin_list_founding_pro_applications — return type gains four
-- invitation columns (drop+recreate required for a returns-table shape
-- change, same as invite_to_workspace's own precedent, 0032). Every
-- existing column keeps its exact name and position; nothing here can
-- break Phase 3's existing consumers, only add to what they can read.
-- ---------------------------------------------------------------------

drop function if exists public.admin_list_founding_pro_applications();

create function public.admin_list_founding_pro_applications()
returns table (
  id uuid,
  user_id uuid,
  applicant_email text,
  applicant_name text,
  status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  reviewer_email text,
  review_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  member_id uuid,
  member_number int,
  member_slot_type text,
  invitation_id uuid,
  invitation_status text,
  invitation_founding_price_cents int,
  invitation_currency text,
  invited_at timestamptz,
  invitation_accepted_at timestamptz
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
      a.id, a.user_id, p.email, p.display_name, a.status, a.submitted_at,
      a.reviewed_at, a.reviewed_by, rp.email, a.review_notes, a.created_at, a.updated_at,
      m.id, m.founding_member_number, m.slot_type,
      i.id, i.status, i.founding_price_cents, i.currency, i.invited_at, i.accepted_at
    from public.founding_pro_applications a
    left join public.profiles p on p.id = a.user_id
    left join public.profiles rp on rp.id = a.reviewed_by
    left join public.founding_pro_members m on m.application_id = a.id
    left join public.founding_pro_invitations i on i.application_id = a.id
    order by
      case a.status when 'pending' then 0 else 1 end,
      a.submitted_at desc;
end;
$$;

revoke execute on function public.admin_list_founding_pro_applications() from public, anon;
grant execute on function public.admin_list_founding_pro_applications() to authenticated;
