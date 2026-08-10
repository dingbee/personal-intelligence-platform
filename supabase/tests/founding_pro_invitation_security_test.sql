-- Founding Pro Programme Phase 4 — invitation & self-service atomic
-- enrollment security/lifecycle test. Same conventions as the Phase 1/2/3
-- test files: each numbered block is a self-contained `begin; ...
-- rollback;` transaction (mutating blocks only), `request.jwt.claims`
-- simulates a real authenticated session (no role switch).
--
-- Users used (real auth.users rows, never persisted — see header rationale
-- in founding_pro_admin_operations_security_test.sql for why real ids are
-- used purely as valid FK targets):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co) — real admin
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)
--
-- Deliberately does NOT reuse 5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1
-- (engutoto@gmail.com) anywhere in this file — that user has a real, live
-- pending Founding Pro application and this file must never touch real
-- application state, even inside a rolled-back transaction.

-- ---------------------------------------------------------------------
-- 1. Anonymous invitation creation rejected (structural grant check —
--    admin_invite_founding_pro_member is revoked from anon).
-- ---------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'public.admin_invite_founding_pro_member(uuid,integer,text)', 'EXECUTE') then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (1): anon can execute admin_invite_founding_pro_member';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (1) PASSED: anon is grant-blocked from admin_invite_founding_pro_member';
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Non-admin invitation creation rejected.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'approved')
  returning id into v_app;

  begin
    perform public.admin_invite_founding_pro_member(v_app, 1999, 'USD');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (2): a non-admin was able to send a Founding Pro invitation';
  end if;

  if exists (select 1 from public.founding_pro_invitations where application_id = v_app) then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (2): an invitation row was created despite non-admin rejection';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (2) PASSED: a non-admin cannot send a Founding Pro invitation';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. Only approved applications can be invited.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_pending_app uuid;
  v_rejected_app uuid;
  v_failed_pending boolean := false;
  v_failed_rejected boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'pending')
  returning id into v_pending_app;

  insert into public.founding_pro_applications (user_id, status)
  values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'rejected')
  returning id into v_rejected_app;

  begin
    perform public.admin_invite_founding_pro_member(v_pending_app, 1999, 'USD');
  exception when others then
    v_failed_pending := true;
  end;

  begin
    perform public.admin_invite_founding_pro_member(v_rejected_app, 1999, 'USD');
  exception when others then
    v_failed_rejected := true;
  end;

  if not v_failed_pending or not v_failed_rejected then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (3): a non-approved application was invited';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (3) PASSED: only approved applications can be invited';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Duplicate active invitation prevented.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed boolean := false;
  v_invitation_count int;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'approved')
  returning id into v_app;

  perform public.admin_invite_founding_pro_member(v_app, 1999, 'USD');

  begin
    perform public.admin_invite_founding_pro_member(v_app, 2999, 'USD');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (4): a duplicate active invitation was created';
  end if;

  select count(*) into v_invitation_count from public.founding_pro_invitations where application_id = v_app;
  if v_invitation_count <> 1 then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (4): expected exactly 1 invitation row, found %', v_invitation_count;
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (4) PASSED: duplicate active invitations are prevented';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Invitation cannot be accepted by another user.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'approved')
  returning id into v_app;

  perform public.admin_invite_founding_pro_member(v_app, 1999, 'USD');
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.accept_founding_pro_invitation();
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (5): a different user was able to accept someone else''s invitation';
  end if;

  if exists (select 1 from public.founding_pro_members where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d') then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (5): the wrong user was enrolled';
  end if;

  if (select status from public.founding_pro_invitations where application_id in (
    select id from public.founding_pro_applications where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba' order by created_at desc limit 1
  )) <> 'pending' then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (5): the real invitee''s invitation status was changed by another user''s failed attempt';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (5) PASSED: an invitation cannot be accepted by another user';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. Unauthenticated acceptance rejected (structural grant check —
--    accept_founding_pro_invitation is revoked from anon; the function
--    also explicitly checks auth.uid() is not null as defense in depth).
-- ---------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'public.accept_founding_pro_invitation()', 'EXECUTE') then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (6): anon can execute accept_founding_pro_invitation';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (6) PASSED: anon is grant-blocked from accept_founding_pro_invitation';
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Invitation cannot be reused.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'approved')
  returning id into v_app;

  perform public.admin_invite_founding_pro_member(v_app, 1999, 'USD');
end;
$$;

set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_first_result jsonb;
  v_failed_second boolean := false;
begin
  v_first_result := public.accept_founding_pro_invitation();
  if v_first_result->>'outcome' <> 'enrolled' then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (7): first acceptance did not enroll';
  end if;

  begin
    perform public.accept_founding_pro_invitation();
  exception when others then
    v_failed_second := true;
  end;

  if not v_failed_second then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (7): the same invitation was accepted twice';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (7) PASSED: an invitation cannot be reused';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 8. Already-enrolled application cannot be accepted/invited again.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'approved')
  returning id into v_app;

  perform public.admin_invite_founding_pro_member(v_app, 1999, 'USD');
end;
$$;

set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
do $$ begin perform public.accept_founding_pro_invitation(); end; $$;

set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed boolean := false;
begin
  select id into v_app from public.founding_pro_applications where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba' order by created_at desc limit 1;

  if (select status from public.founding_pro_applications where id = v_app) <> 'enrolled' then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (8): application was not marked enrolled after acceptance';
  end if;

  begin
    perform public.admin_invite_founding_pro_member(v_app, 999, 'USD');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (8): an already-enrolled application was invited again';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (8) PASSED: an already-enrolled application cannot be invited or accepted again';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 9. Enrollment still respects the 100-slot atomic cap. Temporarily
--    drives the real capacity counter to its max inside this rolled-
--    back transaction only — never committed, never visible to any
--    concurrent reader outside this transaction.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
begin
  update public.founding_pro_capacity set enrolled_public_count = max_public_slots where id = 1;

  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'approved')
  returning id into v_app;

  perform public.admin_invite_founding_pro_member(v_app, 1999, 'USD');
end;
$$;

set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.accept_founding_pro_invitation();
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (9): acceptance succeeded despite capacity already at max';
  end if;

  if exists (select 1 from public.founding_pro_members where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba') then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (9): a member row was created despite capacity being full';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (9) PASSED: enrollment still respects the 100-slot atomic cap';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 10. No client-side direct writes to Founding Pro
--     membership/capacity/events/invitations.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_failed_invitations boolean := false;
  v_failed_members boolean := false;
  v_failed_capacity boolean := false;
  v_failed_events boolean := false;
begin
  begin
    insert into public.founding_pro_invitations (application_id, user_id, founding_price_cents)
    values (gen_random_uuid(), '249c4f9a-fe94-4174-af49-ca38d526caba', 100);
  exception when others then
    v_failed_invitations := true;
  end;

  begin
    insert into public.founding_pro_members (user_id, slot_type, founding_price_cents, founding_expires_at)
    values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'public', 100, now());
  exception when others then
    v_failed_members := true;
  end;

  begin
    update public.founding_pro_capacity set enrolled_public_count = 0 where id = 1;
  exception when others then
    v_failed_capacity := true;
  end;

  begin
    insert into public.founding_pro_events (event_type, target_user_id)
    values ('admin_action', '249c4f9a-fe94-4174-af49-ca38d526caba');
  exception when others then
    v_failed_events := true;
  end;

  if not v_failed_invitations or not v_failed_members or not v_failed_capacity or not v_failed_events then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (10): a client was able to write directly to Founding Pro state';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (10) PASSED: no client-side direct writes to Founding Pro membership/capacity/events/invitations';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 11. Invitation token/secret is never exposed in ordinary admin list
--     responses. By design there is no token/secret column anywhere in
--     this schema (acceptance is identity-authorized, not token-
--     authorized — see 0055's own comment); this asserts that design
--     invariant structurally rather than just by absence of a field.
-- ---------------------------------------------------------------------

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.admin_list_founding_pro_applications()'::regprocedure);

  if lower(v_def) like '%token%' or lower(v_def) like '%secret%' then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (11): admin_list_founding_pro_applications references a token/secret concept';
  end if;

  if lower(pg_get_functiondef('public.accept_founding_pro_invitation()'::regprocedure)) like '%token%' then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (11): accept_founding_pro_invitation references a token concept';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (11) PASSED: no invitation token/secret concept exists anywhere to leak';
end;
$$;

-- ---------------------------------------------------------------------
-- 12. Existing Phase 1/2/3 security invariants remain intact after the
--     Phase 4 refactor: admin_enroll_founding_pro_member is still
--     admin-gated (the single highest-risk regression from extracting
--     founding_pro_enroll_member_core), and the new internal core
--     function is reachable by NOBODY directly (not even an admin) —
--     it is only ever invoked function-to-function.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'approved')
  returning id into v_app;

  begin
    perform public.admin_enroll_founding_pro_member(v_app, 'public', 1999, 'USD');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (12): admin_enroll_founding_pro_member no longer admin-gated after the Phase 4 refactor';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (12a) PASSED: admin_enroll_founding_pro_member remains admin-gated';
end;
$$;

rollback;

do $$
begin
  if has_function_privilege('anon', 'public.founding_pro_enroll_member_core(uuid,text,integer,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.founding_pro_enroll_member_core(uuid,text,integer,text,uuid)', 'EXECUTE') then
    raise exception 'FOUNDING PRO INVITATION TEST FAILED (12): founding_pro_enroll_member_core is directly reachable by a client role';
  end if;

  raise notice 'FOUNDING PRO INVITATION TEST (12b) PASSED: founding_pro_enroll_member_core is unreachable by any client role, only via the two authorized entry points';
end;
$$;
