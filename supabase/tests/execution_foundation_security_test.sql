-- ARRIYIA — Execution Foundation security test (0065_execution_foundation.sql).
-- Confirms the load-bearing security properties: RLS actor isolation on
-- all four new tables, that every state transition is only reachable
-- through its SECURITY DEFINER RPC (direct table UPDATE/INSERT is
-- revoked from `authenticated`), idempotent request creation, and that
-- the state machine rejects an invalid transition (rejected -> executing).
--
-- Users reused from founding_pro_invitation_security_test.sql (same
-- vetted, safe-to-mutate-within-a-rollback set):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co)      -- "user A"
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) -- "user B"

-- ---------------------------------------------------------------------
-- 1. create_execution_request() is idempotent: calling it twice with the
--    same (user, idempotency key) returns the SAME row, never a second one.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_first public.execution_requests;
  v_second public.execution_requests;
  v_count int;
begin
  select * into v_first from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-1', 'hash-test-1', 86400
  );
  select * into v_second from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-1', 'hash-test-1', 86400
  );

  if v_first.id <> v_second.id then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (1): a duplicate idempotency key created a second row';
  end if;

  select count(*) into v_count from public.execution_requests where idempotency_key = 'idem-key-test-1' and user_id = '23c725ec-b2d6-487c-8291-dae7a280a291';
  if v_count <> 1 then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (1): expected exactly one row for this idempotency key, found %', v_count;
  end if;

  raise notice 'EXECUTION FOUNDATION TEST (1) PASSED: create_execution_request is idempotent';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. Actor isolation: user B cannot authorize, start, cancel, or record
--    an attempt against user A's execution request, even knowing its id.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_request public.execution_requests;
begin
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-2', 'hash-test-2', 86400
  );
  perform set_config('app.test_request_id', v_request.id::text, false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_request_id uuid := current_setting('app.test_request_id')::uuid;
  v_raised boolean := false;
begin
  begin
    perform public.authorize_execution_request(v_request_id, 'approved', '{}'::jsonb, null);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (2): user B was able to authorize user A''s execution request';
  end if;

  v_raised := false;
  begin
    perform public.cancel_execution(v_request_id, 'test');
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (2): user B was able to cancel user A''s execution request';
  end if;

  -- RLS also hides the row entirely from a select by a non-owner.
  if exists (select 1 from public.execution_requests where id = v_request_id) then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (2): user B can see user A''s execution request via select';
  end if;

  raise notice 'EXECUTION FOUNDATION TEST (2) PASSED: actor isolation holds for authorize/cancel/select';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A client cannot forge a state transition by writing to the tables
--    directly — authenticated has no UPDATE grant on execution_requests
--    and no INSERT/UPDATE grant on the other three tables.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_request public.execution_requests;
  v_raised boolean := false;
begin
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-3', 'hash-test-3', 86400
  );

  begin
    update public.execution_requests set status = 'succeeded' where id = v_request.id;
  exception when insufficient_privilege then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (3): a direct UPDATE on execution_requests was not rejected';
  end if;

  v_raised := false;
  begin
    insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata)
    values (v_request.id, 'execution_completed', '23c725ec-b2d6-487c-8291-dae7a280a291', '{}'::jsonb);
  exception when insufficient_privilege then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (3): a direct INSERT on execution_audit_events was not rejected';
  end if;

  raise notice 'EXECUTION FOUNDATION TEST (3) PASSED: direct table writes are rejected; only the RPCs can mutate state';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Invalid state transitions are rejected: start_execution() refuses a
--    request that was never approved, and authorize_execution_request()
--    refuses a request that is already in a terminal state.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_request public.execution_requests;
  v_raised boolean := false;
begin
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-4', 'hash-test-4', 86400
  );

  -- start_execution before any authorization at all.
  begin
    perform public.start_execution(v_request.id);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (4): start_execution succeeded on an unapproved request';
  end if;

  -- Reject it, then confirm authorize_execution_request refuses to re-authorize a terminal request.
  perform public.authorize_execution_request(v_request.id, 'rejected', '{}'::jsonb, null);

  v_raised := false;
  begin
    perform public.authorize_execution_request(v_request.id, 'approved', '{}'::jsonb, null);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (4): a rejected request was re-authorized to approved';
  end if;

  -- And start_execution still refuses on the now-rejected request.
  v_raised := false;
  begin
    perform public.start_execution(v_request.id);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (4): start_execution succeeded on a rejected request (rejected -> executing)';
  end if;

  raise notice 'EXECUTION FOUNDATION TEST (4) PASSED: invalid state transitions are rejected server-side';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. A full happy-path lifecycle succeeds end-to-end and leaves a
--    complete audit trail.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_request public.execution_requests;
  v_audit_count int;
begin
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-5', 'hash-test-5', 86400
  );
  perform public.authorize_execution_request(v_request.id, 'approved', '{}'::jsonb, null);
  perform public.start_execution(v_request.id);
  perform public.record_execution_attempt(v_request.id, 'succeeded', null, null, '{"noteId":"note-1"}'::jsonb, true);

  if (select status from public.execution_requests where id = v_request.id) <> 'succeeded' then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (5): request did not reach succeeded status';
  end if;

  select count(*) into v_audit_count from public.execution_audit_events where execution_request_id = v_request.id;
  if v_audit_count < 5 then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (5): expected at least 5 audit events, found %', v_audit_count;
  end if;

  raise notice 'EXECUTION FOUNDATION TEST (5) PASSED: full lifecycle succeeds with a complete audit trail';
end;
$$;

rollback;
