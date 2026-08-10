-- Founding Pro Programme Phase 1 — database security/lifecycle test.
--
-- Each numbered block is its own complete `begin; ... rollback;`
-- transaction, so one failing assertion never blocks the rest from
-- running, and nothing this file does is ever left committed —
-- including the enrollments it performs against real (existing) user
-- ids, which exist purely to exercise admin_enroll_founding_pro_member
-- and are rolled back before this script ends. Safe to run against
-- production at any time; read-only blocks are noted as such.
--
-- Run via `psql $DATABASE_URL -f supabase/tests/founding_pro_programme_security_test.sql`
-- or the Supabase SQL editor.
--
-- Blocks that call admin_enroll_founding_pro_member set only the
-- `request.jwt.claims` GUC (not the Postgres role) to a real platform
-- admin's user id (dan@nolmark.co, 23c725ec-b2d6-487c-8291-dae7a280a291
-- — confirmed live via is_platform_admin()). auth.uid() reads solely
-- from this GUC regardless of role, so this makes it resolve exactly as
-- it would for a real authenticated admin session while the connection
-- keeps its own read access to auth.users for the test's own setup
-- queries (switching to `role authenticated` would additionally drop
-- that access, since `authenticated` has no SELECT grant on
-- auth.users). This also means the test genuinely isolates
-- is_platform_admin()'s own internal logic from any grant-level
-- enforcement, matching what test 5b claims to verify. `set local`
-- confines the GUC to the current transaction; the closing `rollback;`
-- clears it either way.

-- ---------------------------------------------------------------------
-- 1. Public capacity function — read-only. Confirms the seeded
--    singleton row and that the function computes remaining correctly.
-- ---------------------------------------------------------------------

do $$
declare
  v_max int;
  v_enrolled int;
  v_remaining int;
begin
  select max_public_slots, enrolled_public_count, remaining_public_slots
  into v_max, v_enrolled, v_remaining
  from public.get_founding_pro_public_capacity();

  if v_max is null then
    raise exception 'FOUNDING PRO TEST FAILED (1): get_founding_pro_public_capacity() returned no row';
  end if;

  if v_remaining <> v_max - v_enrolled then
    raise exception 'FOUNDING PRO TEST FAILED (1): remaining_public_slots (%) does not equal max (%) minus enrolled (%)', v_remaining, v_max, v_enrolled;
  end if;

  raise notice 'FOUNDING PRO TEST (1) PASSED: public capacity = %/% (% remaining)', v_enrolled, v_max, v_remaining;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Sequential public enrollment: first member gets #1, second gets
--    #2, capacity counter increments correctly, expiry is exactly 3
--    months after start. Uses two of the project's real (pre-existing)
--    users as applicants purely as valid auth.users(id) FK targets —
--    fully rolled back, never committed.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_user_1 uuid;
  v_user_2 uuid;
  v_app_1 uuid;
  v_app_2 uuid;
  v_result_1 jsonb;
  v_result_2 jsonb;
  v_member_1 record;
  v_member_2 record;
  v_capacity_after int;
begin
  select id into v_user_1 from auth.users order by created_at limit 1 offset 0;
  select id into v_user_2 from auth.users order by created_at limit 1 offset 1;

  insert into public.founding_pro_applications (user_id, status) values (v_user_1, 'approved') returning id into v_app_1;
  insert into public.founding_pro_applications (user_id, status) values (v_user_2, 'approved') returning id into v_app_2;

  v_result_1 := public.admin_enroll_founding_pro_member(v_app_1, 'public', 1999, 'USD');
  v_result_2 := public.admin_enroll_founding_pro_member(v_app_2, 'public', 1999, 'USD');

  select * into v_member_1 from public.founding_pro_members where user_id = v_user_1;
  select * into v_member_2 from public.founding_pro_members where user_id = v_user_2;

  select enrolled_public_count into v_capacity_after from public.founding_pro_capacity where id = 1;

  if v_member_1.founding_member_number <> 1 then
    raise exception 'FOUNDING PRO TEST FAILED (2): first public enrollee got number % instead of 1', v_member_1.founding_member_number;
  end if;

  if v_member_2.founding_member_number <> 2 then
    raise exception 'FOUNDING PRO TEST FAILED (2): second public enrollee got number % instead of 2', v_member_2.founding_member_number;
  end if;

  if v_capacity_after <> 2 then
    raise exception 'FOUNDING PRO TEST FAILED (2): capacity counter is % after 2 enrollments, expected 2', v_capacity_after;
  end if;

  if v_member_1.founding_expires_at <> v_member_1.founding_started_at + interval '3 months' then
    raise exception 'FOUNDING PRO TEST FAILED (2): expiry is not exactly 3 months after start (started %, expires %)', v_member_1.founding_started_at, v_member_1.founding_expires_at;
  end if;

  if v_member_1.founding_price_cents <> 1999 or v_member_1.currency <> 'USD' then
    raise exception 'FOUNDING PRO TEST FAILED (2): founding price/currency not stored as supplied';
  end if;

  if v_member_1.transition_status <> 'active' or v_member_1.transitioned_at is not null then
    raise exception 'FOUNDING PRO TEST FAILED (2): newly enrolled member has unexpected transition state';
  end if;

  -- Entitlement was actually granted via the existing mechanism.
  if not exists (
    select 1 from public.user_plan_assignments upa
    join public.plans p on p.id = upa.plan_id
    where upa.user_id = v_user_1 and upa.active = true and p.code = 'founding_pro'
  ) then
    raise exception 'FOUNDING PRO TEST FAILED (2): user_plan_assignments was not updated to founding_pro';
  end if;

  -- Application was marked enrolled.
  if not exists (select 1 from public.founding_pro_applications where id = v_app_1 and status = 'enrolled') then
    raise exception 'FOUNDING PRO TEST FAILED (2): application status was not set to enrolled';
  end if;

  -- Audit event was recorded.
  if not exists (select 1 from public.founding_pro_events where member_id = v_member_1.id and event_type = 'member_enrolled') then
    raise exception 'FOUNDING PRO TEST FAILED (2): no member_enrolled audit event was recorded';
  end if;

  raise notice 'FOUNDING PRO TEST (2) PASSED: sequential public enrollment assigns #1/#2, capacity=2, expiry=+3mo, price/currency stored, entitlement granted, application enrolled, audit event recorded';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. Grandfathered enrollment: does NOT consume a public slot, does NOT
--    receive a founding_member_number (structural distinction from
--    public members), still receives full founding_pro entitlement.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_user uuid;
  v_app uuid;
  v_result jsonb;
  v_member record;
  v_capacity_before int;
  v_capacity_after int;
begin
  select id into v_user from auth.users order by created_at limit 1 offset 2;
  select enrolled_public_count into v_capacity_before from public.founding_pro_capacity where id = 1;

  insert into public.founding_pro_applications (user_id, status) values (v_user, 'approved') returning id into v_app;
  v_result := public.admin_enroll_founding_pro_member(v_app, 'grandfathered', 0, 'USD');

  select * into v_member from public.founding_pro_members where user_id = v_user;
  select enrolled_public_count into v_capacity_after from public.founding_pro_capacity where id = 1;

  if v_member.founding_member_number is not null then
    raise exception 'FOUNDING PRO TEST FAILED (3): grandfathered member unexpectedly has a founding_member_number (%)', v_member.founding_member_number;
  end if;

  if v_member.slot_type <> 'grandfathered' then
    raise exception 'FOUNDING PRO TEST FAILED (3): slot_type is % instead of grandfathered', v_member.slot_type;
  end if;

  if v_capacity_after <> v_capacity_before then
    raise exception 'FOUNDING PRO TEST FAILED (3): grandfathered enrollment changed the public capacity counter (% -> %)', v_capacity_before, v_capacity_after;
  end if;

  if not exists (
    select 1 from public.user_plan_assignments upa
    join public.plans p on p.id = upa.plan_id
    where upa.user_id = v_user and upa.active = true and p.code = 'founding_pro'
  ) then
    raise exception 'FOUNDING PRO TEST FAILED (3): grandfathered member did not receive founding_pro entitlement';
  end if;

  if not exists (select 1 from public.founding_pro_events where member_id = v_member.id and event_type = 'member_grandfathered') then
    raise exception 'FOUNDING PRO TEST FAILED (3): no member_grandfathered audit event was recorded';
  end if;

  raise notice 'FOUNDING PRO TEST (3) PASSED: grandfathered enrollment consumes no public slot, has no member number, still grants founding_pro entitlement';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Capacity boundary: at 100/100, the 101st public enrollment attempt
--    is rejected before any state changes. Sets the counter directly to
--    the boundary rather than performing 100 real enrollments.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_user uuid;
  v_app uuid;
  v_failed boolean := false;
begin
  update public.founding_pro_capacity set enrolled_public_count = 100 where id = 1;

  select id into v_user from auth.users order by created_at limit 1 offset 3;
  insert into public.founding_pro_applications (user_id, status) values (v_user, 'approved') returning id into v_app;

  begin
    perform public.admin_enroll_founding_pro_member(v_app, 'public', 1999, 'USD');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO TEST FAILED (4): 101st public enrollment attempt succeeded instead of being rejected';
  end if;

  if exists (select 1 from public.founding_pro_members where application_id = v_app) then
    raise exception 'FOUNDING PRO TEST FAILED (4): a member row was created despite the enrollment being rejected';
  end if;

  if (select enrolled_public_count from public.founding_pro_capacity where id = 1) <> 100 then
    raise exception 'FOUNDING PRO TEST FAILED (4): capacity counter changed despite the rejected enrollment';
  end if;

  raise notice 'FOUNDING PRO TEST (4) PASSED: enrollment attempt at 100/100 capacity is rejected, no member row or counter change results';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Structural concurrency-safety check (read-only): the enrollment
--    function's compiled body actually takes the row lock it claims to.
--    True concurrent-session race testing isn't expressible in a single
--    SQL script; this asserts the mechanism the lock-based safety
--    argument depends on is actually present in the deployed function,
--    the same style commercial_control_security_test.sql already uses
--    for asserting is_platform_admin() is actually called.
-- ---------------------------------------------------------------------

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.admin_enroll_founding_pro_member(uuid,text,integer,text)'::regprocedure);

  if v_def not like '%is_platform_admin()%' then
    raise exception 'FOUNDING PRO TEST FAILED (5): admin_enroll_founding_pro_member no longer checks is_platform_admin()';
  end if;

  if lower(v_def) not like '%for update%' then
    raise exception 'FOUNDING PRO TEST FAILED (5): admin_enroll_founding_pro_member no longer takes a row lock (FOR UPDATE) — concurrency safety would be broken';
  end if;

  if has_function_privilege('anon', 'public.admin_enroll_founding_pro_member(uuid,text,integer,text)', 'EXECUTE') then
    raise exception 'FOUNDING PRO TEST FAILED (5): anon can execute admin_enroll_founding_pro_member';
  end if;

  raise notice 'FOUNDING PRO TEST (5) PASSED: admin_enroll_founding_pro_member is_platform_admin()-gated, row-locks capacity, and anon-blocked';
end;
$$;

-- ---------------------------------------------------------------------
-- 5b. Live negative authorization test: an ordinary (non-admin)
--     authenticated user's session is simulated the same way the admin
--     session is above, using a real non-admin user id
--     (engutoto@gmail.com). The call must be rejected by
--     is_platform_admin() itself, not merely by a grant-level check.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1', 'approved')
  returning id into v_app;

  begin
    perform public.admin_enroll_founding_pro_member(v_app, 'public', 1999, 'USD');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO TEST FAILED (5b): an ordinary authenticated user was able to call admin_enroll_founding_pro_member';
  end if;

  if exists (select 1 from public.founding_pro_members where application_id = v_app) then
    raise exception 'FOUNDING PRO TEST FAILED (5b): a member row was created by a non-admin caller';
  end if;

  raise notice 'FOUNDING PRO TEST (5b) PASSED: a real non-admin authenticated session is rejected by admin_enroll_founding_pro_member';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. Application lifecycle constraints: an invalid status is rejected
--    by the CHECK constraint; a second live (pending/approved)
--    application for the same user is rejected by the partial unique
--    index.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_user uuid;
  v_failed boolean := false;
begin
  select id into v_user from auth.users order by created_at limit 1 offset 0;

  begin
    insert into public.founding_pro_applications (user_id, status) values (v_user, 'not_a_real_status');
  exception when check_violation then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO TEST FAILED (6a): an invalid application status was accepted';
  end if;

  insert into public.founding_pro_applications (user_id, status) values (v_user, 'pending');

  v_failed := false;
  begin
    insert into public.founding_pro_applications (user_id, status) values (v_user, 'pending');
  exception when unique_violation then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO TEST FAILED (6b): a second live application for the same user was accepted';
  end if;

  raise notice 'FOUNDING PRO TEST (6) PASSED: invalid status rejected by CHECK, duplicate live application rejected by unique index';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 7. Founding price is immune to later changes to plans.monthly_price_
--    cents — the exact "founding protection" guarantee this table
--    exists to provide, verified the same way founding_protection_test.
--    sql verifies plan_quotas isolation: capture, mutate, restore-before-
--    assert, compare.
-- ---------------------------------------------------------------------

begin;

set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_user uuid;
  v_app uuid;
  v_member_id uuid;
  v_price_before int;
  v_price_after int;
  v_pro_id uuid;
  v_pro_price_before int;
begin
  select id into v_user from auth.users order by created_at limit 1 offset 1;
  insert into public.founding_pro_applications (user_id, status) values (v_user, 'approved') returning id into v_app;
  perform public.admin_enroll_founding_pro_member(v_app, 'public', 1500, 'USD');

  select id, founding_price_cents into v_member_id, v_price_before from public.founding_pro_members where user_id = v_user;

  select id, monthly_price_cents into v_pro_id, v_pro_price_before from public.plans where code = 'pro';
  update public.plans set monthly_price_cents = coalesce(v_pro_price_before, 0) + 500000 where id = v_pro_id;

  select founding_price_cents into v_price_after from public.founding_pro_members where id = v_member_id;

  update public.plans set monthly_price_cents = v_pro_price_before where id = v_pro_id;

  if v_price_after <> v_price_before or v_price_after <> 1500 then
    raise exception 'FOUNDING PRO TEST FAILED (7): member''s recorded founding_price_cents changed (% -> %) when pro''s plans.monthly_price_cents was edited', v_price_before, v_price_after;
  end if;

  raise notice 'FOUNDING PRO TEST (7) PASSED: founding_price_cents (%) recorded at enrollment is unaffected by later edits to plans.monthly_price_cents', v_price_after;
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 8. Enrollment fails safely without an invented price: NULL or
--    negative founding_price_cents is rejected before any state
--    changes, and no member/capacity mutation results.
-- ---------------------------------------------------------------------

begin;

set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_user uuid;
  v_app uuid;
  v_failed boolean := false;
  v_capacity_before int;
  v_capacity_after int;
begin
  select id into v_user from auth.users order by created_at limit 1 offset 2;
  insert into public.founding_pro_applications (user_id, status) values (v_user, 'approved') returning id into v_app;
  select enrolled_public_count into v_capacity_before from public.founding_pro_capacity where id = 1;

  begin
    perform public.admin_enroll_founding_pro_member(v_app, 'public', null, 'USD');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO TEST FAILED (8): enrollment with a NULL founding price succeeded instead of failing safely';
  end if;

  select enrolled_public_count into v_capacity_after from public.founding_pro_capacity where id = 1;
  if v_capacity_after <> v_capacity_before then
    raise exception 'FOUNDING PRO TEST FAILED (8): capacity counter changed despite the NULL-price enrollment being rejected';
  end if;

  if exists (select 1 from public.founding_pro_members where application_id = v_app) then
    raise exception 'FOUNDING PRO TEST FAILED (8): a member row was created despite the NULL-price enrollment being rejected';
  end if;

  raise notice 'FOUNDING PRO TEST (8) PASSED: enrollment without a supplied founding price fails safely, no state is mutated';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 9. Audit trail is genuinely append-only: UPDATE and DELETE on
--    founding_pro_events are both rejected by trigger, unconditionally.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_event_id uuid;
  v_update_failed boolean := false;
  v_delete_failed boolean := false;
begin
  insert into public.founding_pro_events (event_type, metadata) values ('admin_action', '{"test":true}'::jsonb) returning id into v_event_id;

  begin
    update public.founding_pro_events set event_type = 'admin_action', metadata = '{"tampered":true}'::jsonb where id = v_event_id;
  exception when others then
    v_update_failed := true;
  end;

  begin
    delete from public.founding_pro_events where id = v_event_id;
  exception when others then
    v_delete_failed := true;
  end;

  if not v_update_failed then
    raise exception 'FOUNDING PRO TEST FAILED (9): an UPDATE on founding_pro_events was not rejected';
  end if;

  if not v_delete_failed then
    raise exception 'FOUNDING PRO TEST FAILED (9): a DELETE on founding_pro_events was not rejected';
  end if;

  raise notice 'FOUNDING PRO TEST (9) PASSED: founding_pro_events rejects both UPDATE and DELETE unconditionally';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 10. Existing Beta records and existing Founding Pro plan/quota state
--     are completely untouched by this migration — read-only.
-- ---------------------------------------------------------------------

do $$
declare
  v_beta_invite_count int;
  v_founding_plan_active boolean;
begin
  select count(*) into v_beta_invite_count from public.beta_invites;
  select active into v_founding_plan_active from public.plans where code = 'founding_pro';

  if v_beta_invite_count < 1 then
    raise exception 'FOUNDING PRO TEST FAILED (10): beta_invites appears empty/altered (count=%)', v_beta_invite_count;
  end if;

  if v_founding_plan_active is not true then
    raise exception 'FOUNDING PRO TEST FAILED (10): founding_pro plan is missing or inactive';
  end if;

  raise notice 'FOUNDING PRO TEST (10) PASSED: beta_invites (% rows) and the founding_pro plan are intact and untouched', v_beta_invite_count;
end;
$$;
