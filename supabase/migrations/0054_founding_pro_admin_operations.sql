-- Founding Pro Programme — Phase 3: the admin operational surface's
-- read/mutation primitives. Five new SECURITY DEFINER functions, all
-- is_platform_admin()-gated exactly like every other admin_* RPC in this
-- codebase (admin_list_users, admin_list_beta_invites, etc. —
-- 0035_platform_admin_foundation.sql). Nothing here touches Phase 1's
-- table definitions, constraints, or triggers, and nothing here calls
-- admin_enroll_founding_pro_member — approval only ever moves an
-- application from 'pending' to 'approved'/'rejected'; it never assigns
-- a slot, a founding_member_number, a price, or the founding_pro plan.
-- Enrollment (the actual slot reservation + entitlement grant) remains
-- exactly what Phase 1 already built and this migration does not touch.
--
-- Three read RPCs (admin_list_founding_pro_applications/_members/_events)
-- join public.profiles for applicant/reviewer/actor/target email and
-- display name, the same safe pattern admin_list_users already uses
-- (0035) — profiles is a mirror of auth.users with RLS the SECURITY
-- DEFINER function bypasses, so this never touches auth.users directly
-- and never needs a broader grant on it. The public 100-slot capacity
-- number itself is deliberately NOT reintroduced here: the admin page
-- reads that from the existing, already-authoritative
-- get_founding_pro_public_capacity() (0052), so there is exactly one
-- source of truth for that figure, admin surface included.
--
-- Two mutation RPCs (admin_approve_founding_pro_application /
-- admin_reject_founding_pro_application) share one lifecycle rule: an
-- application can only be approved or rejected while it is 'pending'.
-- That single guard is what makes "already approved cannot be approved
-- again," "a rejected application cannot be re-rejected," and "an
-- enrolled application cannot be reverted through these actions" all
-- true at once — none of those states are 'pending', so the guard
-- rejects every one of them uniformly, with no special-casing per
-- target state. Both lock the row with `for update` before checking, so
-- two simultaneous approve/reject calls on the same application can't
-- race past the pending check together. Both take an optional
-- `p_review_notes` — this reuses the review_notes column Phase 1 already
-- added and left unused, rather than expanding the schema for it; no
-- reviewer-notes UI is built this phase (see the Phase 3 report's
-- backlog), so the parameter defaults to null today and is simply
-- available for a later UI to pass through unchanged.

create or replace function public.admin_list_founding_pro_applications()
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
  member_slot_type text
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
      m.id, m.founding_member_number, m.slot_type
    from public.founding_pro_applications a
    left join public.profiles p on p.id = a.user_id
    left join public.profiles rp on rp.id = a.reviewed_by
    left join public.founding_pro_members m on m.application_id = a.id
    order by
      case a.status when 'pending' then 0 else 1 end,
      a.submitted_at desc;
end;
$$;

revoke execute on function public.admin_list_founding_pro_applications() from public, anon;
grant execute on function public.admin_list_founding_pro_applications() to authenticated;

create or replace function public.admin_list_founding_pro_members()
returns table (
  id uuid,
  user_id uuid,
  applicant_email text,
  applicant_name text,
  application_id uuid,
  slot_type text,
  founding_member_number int,
  founding_price_cents int,
  currency text,
  founding_started_at timestamptz,
  founding_expires_at timestamptz,
  transition_status text,
  transitioned_at timestamptz,
  created_at timestamptz,
  current_plan_code text
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
      m.id, m.user_id, p.email, p.display_name, m.application_id, m.slot_type,
      m.founding_member_number, m.founding_price_cents, m.currency,
      m.founding_started_at, m.founding_expires_at, m.transition_status, m.transitioned_at, m.created_at,
      pl.code
    from public.founding_pro_members m
    left join public.profiles p on p.id = m.user_id
    left join public.user_plan_assignments upa on upa.user_id = m.user_id and upa.active = true
    left join public.plans pl on pl.id = upa.plan_id
    order by
      case m.slot_type when 'public' then 0 else 1 end,
      m.founding_member_number asc nulls last,
      m.created_at asc;
end;
$$;

revoke execute on function public.admin_list_founding_pro_members() from public, anon;
grant execute on function public.admin_list_founding_pro_members() to authenticated;

create or replace function public.admin_list_founding_pro_events()
returns table (
  id uuid,
  event_type text,
  application_id uuid,
  member_id uuid,
  actor_user_id uuid,
  actor_email text,
  target_user_id uuid,
  target_email text,
  metadata jsonb,
  created_at timestamptz
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
      e.id, e.event_type, e.application_id, e.member_id,
      e.actor_user_id, ap.email, e.target_user_id, tp.email,
      e.metadata, e.created_at
    from public.founding_pro_events e
    left join public.profiles ap on ap.id = e.actor_user_id
    left join public.profiles tp on tp.id = e.target_user_id
    order by e.created_at desc;
end;
$$;

revoke execute on function public.admin_list_founding_pro_events() from public, anon;
grant execute on function public.admin_list_founding_pro_events() to authenticated;

create or replace function public.admin_approve_founding_pro_application(
  p_application_id uuid,
  p_review_notes text default null
)
returns public.founding_pro_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_app public.founding_pro_applications;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  v_admin := auth.uid();

  select * into v_app from public.founding_pro_applications where id = p_application_id for update;
  if v_app.id is null then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Application must be pending to approve (current status: %)', v_app.status;
  end if;

  update public.founding_pro_applications
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = v_admin,
      review_notes = coalesce(p_review_notes, review_notes),
      updated_at = now()
  where id = p_application_id
  returning * into v_app;

  insert into public.founding_pro_events (event_type, application_id, actor_user_id, target_user_id, metadata)
  values (
    'application_approved',
    v_app.id,
    v_admin,
    v_app.user_id,
    jsonb_build_object('review_notes', p_review_notes)
  );

  return v_app;
end;
$$;

revoke all on function public.admin_approve_founding_pro_application(uuid, text) from public, anon;
grant execute on function public.admin_approve_founding_pro_application(uuid, text) to authenticated;

create or replace function public.admin_reject_founding_pro_application(
  p_application_id uuid,
  p_review_notes text default null
)
returns public.founding_pro_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_app public.founding_pro_applications;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  v_admin := auth.uid();

  select * into v_app from public.founding_pro_applications where id = p_application_id for update;
  if v_app.id is null then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Application must be pending to reject (current status: %)', v_app.status;
  end if;

  update public.founding_pro_applications
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = v_admin,
      review_notes = coalesce(p_review_notes, review_notes),
      updated_at = now()
  where id = p_application_id
  returning * into v_app;

  insert into public.founding_pro_events (event_type, application_id, actor_user_id, target_user_id, metadata)
  values (
    'application_rejected',
    v_app.id,
    v_admin,
    v_app.user_id,
    jsonb_build_object('review_notes', p_review_notes)
  );

  return v_app;
end;
$$;

revoke all on function public.admin_reject_founding_pro_application(uuid, text) from public, anon;
grant execute on function public.admin_reject_founding_pro_application(uuid, text) to authenticated;
