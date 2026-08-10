-- Founding Pro Programme — Phase 2: the one addition Phase 1's own
-- comments called out as deliberately deferred — "a future phase can add
-- the submission path without another migration touching this table's
-- shape." Nothing here alters founding_pro_applications/_members/
-- _capacity/_events' columns, constraints, or triggers; it adds exactly
-- one new SECURITY DEFINER function and its grants.
--
-- Why an RPC rather than a plain RLS INSERT policy: every other write
-- path in the Founding Pro Programme (Phase 1's admin_enroll_founding_-
-- pro_member) is a function that re-derives everything it needs
-- server-side rather than trusting client-supplied columns. Doing the
-- same here keeps the grant model uniform across all four tables — none
-- of them ever grant INSERT/UPDATE/DELETE directly to `authenticated`,
-- so "can a client mutate this table's rows directly" has one answer
-- ("no") for the whole feature, not one answer for three tables and a
-- different one for a fourth. It also lets the application row and its
-- `application_submitted` audit event get written atomically, in the
-- same transaction, without ever granting client INSERT on
-- founding_pro_events (which must stay at zero grants for its
-- append-only guarantee to mean anything).
--
-- submit_founding_pro_application() takes no arguments — user_id comes
-- only from auth.uid(), never a client-supplied value, so a caller can
-- only ever submit an application for themselves. It cannot set status
-- to anything but 'pending', cannot set reviewed_at/reviewed_by, cannot
-- touch founding_pro_members/founding_pro_capacity, and cannot invoke
-- admin_enroll_founding_pro_member — there is no code path here that
-- assigns a slot, grants entitlement, or writes a price. The existing
-- partial unique index (founding_pro_applications_one_active_per_user_-
-- idx) remains the actual concurrency-safe guarantee against duplicate
-- submissions; the pre-checks below exist only to produce a clear error
-- message instead of a raw unique-violation for the common case.

create or replace function public.submit_founding_pro_application()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_application_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication is required to apply for Founding Pro';
  end if;

  if exists (select 1 from public.founding_pro_members where user_id = v_user_id) then
    raise exception 'You are already a Founding Pro member';
  end if;

  if exists (
    select 1 from public.founding_pro_applications
    where user_id = v_user_id and status in ('pending', 'approved')
  ) then
    raise exception 'You already have an active Founding Pro application';
  end if;

  insert into public.founding_pro_applications (user_id, status)
  values (v_user_id, 'pending')
  returning id into v_application_id;

  insert into public.founding_pro_events (event_type, application_id, actor_user_id, target_user_id, metadata)
  values ('application_submitted', v_application_id, v_user_id, v_user_id, '{}'::jsonb);

  return jsonb_build_object('application_id', v_application_id, 'status', 'pending');
end;
$$;

revoke all on function public.submit_founding_pro_application() from public, anon;
grant execute on function public.submit_founding_pro_application() to authenticated;
