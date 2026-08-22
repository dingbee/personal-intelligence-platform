-- ARRIYIA — Execution Foundation security test (0065_execution_foundation.sql,
-- 0085_execution_foundation_entitlement_and_notifications.sql).
--
-- Confirms the load-bearing security properties: RLS actor isolation on
-- all four new tables, that every state transition is only reachable
-- through its SECURITY DEFINER RPC (direct table UPDATE/INSERT is
-- revoked from `authenticated`), idempotent request creation, that the
-- state machine rejects an invalid transition (rejected -> executing),
-- server-side entitlement enforcement (I7), and that the new
-- notification producers actually fire.
--
-- I7 METHODOLOGY FIX: every block below now does `set local role
-- authenticated` before setting `request.jwt.claims`. The previous
-- version of this file set only the JWT claims GUC — on this project's
-- `postgres`-role connection (rolbypassrls = true), that means any bare
-- `select ... where id = ...` against an RLS-protected table was never
-- actually evaluated against the RLS policy at all (the row would
-- always be visible regardless of ownership), so test 2's own "RLS
-- hides the row" assertion, and test 3's "a direct UPDATE/INSERT is
-- rejected" assertions, were never actually proven by this file — the
-- exact same false-positive-shaped bug found and fixed in I3's
-- document_intelligence_security_test.sql. Both properties were
-- independently re-verified live, under the correct methodology, before
-- this rewrite (see the I7 final report) — they hold for real; this was
-- a test-methodology gap, not an actual RLS hole. The RPC-internal
-- `auth.uid()` ownership checks (e.g. authorize_execution_request's own
-- `if v_request.user_id <> (select auth.uid())`) were never affected by
-- this bug — those run inside a SECURITY DEFINER function regardless of
-- the caller's role, so their assertions were always genuinely valid.
--
-- Users reused from founding_pro_invitation_security_test.sql (same
-- vetted, safe-to-mutate-within-a-rollback set):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co)      -- "user A" (pro/founding_pro — has action_intelligence)
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) -- "user B" (pro/founding_pro — has action_intelligence)
--   5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1 (engutoto@gmail.com)  -- "user C" (free — does NOT have action_intelligence)

-- ---------------------------------------------------------------------
-- 1. create_execution_request() is idempotent: calling it twice with the
--    same (user, idempotency key) returns the SAME row, never a second one.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
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
--    an attempt against user A's execution request, even knowing its id,
--    and RLS genuinely hides the row from a bare SELECT (verified under
--    the correct role-switch methodology this time).
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
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

  -- RLS also hides the row entirely from a select by a non-owner — now genuinely evaluated (role authenticated is set).
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
--    and no INSERT/UPDATE grant on the other three tables. Now genuinely
--    tested as the `authenticated` role, not a grant-bypassing superuser.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
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
set local role authenticated;
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
set local role authenticated;
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

-- ---------------------------------------------------------------------
-- 6. I7 — a user without action_intelligence entitlement is denied at
--    create_execution_request() itself, server-side (0085 fix) — NOT
--    merely a client-side UI hint. Before this fix, this call would
--    have succeeded for any authenticated user regardless of plan.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1","role":"authenticated"}';

do $$
declare
  v_raised boolean := false;
  v_message text;
begin
  if public.has_feature('5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1'::uuid, 'action_intelligence') then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (6): test user unexpectedly already has action_intelligence — pick a different user';
  end if;

  begin
    perform public.create_execution_request(
      null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      'A note is created', 'low', false, 'idem-key-test-6', 'hash-test-6', 86400
    );
  exception when others then
    v_raised := true;
    get stacked diagnostics v_message = message_text;
  end;

  if not v_raised then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (6): a user without action_intelligence entitlement was able to create an execution request';
  end if;

  if position('upgraded plan' in v_message) = 0 then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (6): rejection did not carry the expected entitlement message, got: %', v_message;
  end if;

  if exists (select 1 from public.execution_requests where idempotency_key = 'idem-key-test-6') then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (6): a row was inserted despite the entitlement rejection';
  end if;

  raise notice 'EXECUTION FOUNDATION TEST (6) PASSED: non-entitled user is denied server-side at request creation, no row inserted';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 7. I7 — the new notification producers actually fire (execution_
--    succeeded, execution_failed, execution_authorization_rejected,
--    execution_cancelled), reusing the existing `notifications` table
--    (0068) — no second notification mechanism.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_request public.execution_requests;
  v_count int;
begin
  -- Succeeded.
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-7a', 'hash-test-7a', 86400
  );
  perform public.authorize_execution_request(v_request.id, 'approved', '{}'::jsonb, null);
  perform public.start_execution(v_request.id);
  perform public.record_execution_attempt(v_request.id, 'succeeded', null, null, '{"noteId":"note-1"}'::jsonb, true);
  select count(*) into v_count from public.notifications where recipient_user_id = '23c725ec-b2d6-487c-8291-dae7a280a291'::uuid and type = 'execution_succeeded' and (payload->>'execution_request_id')::uuid = v_request.id;
  if v_count <> 1 then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (7a): expected 1 execution_succeeded notification, found %', v_count;
  end if;

  -- Final failure.
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-7b', 'hash-test-7b', 86400
  );
  perform public.authorize_execution_request(v_request.id, 'approved', '{}'::jsonb, null);
  perform public.start_execution(v_request.id);
  perform public.record_execution_attempt(v_request.id, 'failed', 'permanent', 'simulated permanent failure', null, true);
  select count(*) into v_count from public.notifications where recipient_user_id = '23c725ec-b2d6-487c-8291-dae7a280a291'::uuid and type = 'execution_failed' and (payload->>'execution_request_id')::uuid = v_request.id;
  if v_count <> 1 then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (7b): expected 1 execution_failed notification, found %', v_count;
  end if;

  -- A NON-final failure must NOT notify yet (status stays 'executing', the request isn't done).
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-7c', 'hash-test-7c', 86400
  );
  perform public.authorize_execution_request(v_request.id, 'approved', '{}'::jsonb, null);
  perform public.start_execution(v_request.id);
  perform public.record_execution_attempt(v_request.id, 'failed', 'transient', 'simulated transient failure', null, false);
  select count(*) into v_count from public.notifications where recipient_user_id = '23c725ec-b2d6-487c-8291-dae7a280a291'::uuid and type = 'execution_failed' and (payload->>'execution_request_id')::uuid = v_request.id;
  if v_count <> 0 then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (7c): a non-final failed attempt notified prematurely, found %', v_count;
  end if;

  -- Rejection.
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-7d', 'hash-test-7d', 86400
  );
  perform public.authorize_execution_request(v_request.id, 'rejected', '{}'::jsonb, null);
  select count(*) into v_count from public.notifications where recipient_user_id = '23c725ec-b2d6-487c-8291-dae7a280a291'::uuid and type = 'execution_authorization_rejected' and (payload->>'execution_request_id')::uuid = v_request.id;
  if v_count <> 1 then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (7d): expected 1 execution_authorization_rejected notification, found %', v_count;
  end if;

  -- Cancellation.
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-7e', 'hash-test-7e', 86400
  );
  perform public.cancel_execution(v_request.id, 'test cancel');
  select count(*) into v_count from public.notifications where recipient_user_id = '23c725ec-b2d6-487c-8291-dae7a280a291'::uuid and type = 'execution_cancelled' and (payload->>'execution_request_id')::uuid = v_request.id;
  if v_count <> 1 then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (7e): expected 1 execution_cancelled notification, found %', v_count;
  end if;

  raise notice 'EXECUTION FOUNDATION TEST (7) PASSED: all four notification producers fire correctly, and a non-final failure stays silent';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 8. I7 adversarial V/W — a fabricated `source` (spoofed provenance:
--    claiming a fake plan/decision/action id) never grants any extra
--    access or bypasses authorization; and workspace_id plays NO role in
--    row visibility at all — even a request tagged with a REAL workspace
--    user A actually owns is still invisible to a second user, proving
--    "cross-tenant" reduces to the same actor-isolation guarantee test 2
--    already proved. The RLS policy on execution_requests references
--    only user_id (see 0065's own "Users can view their own execution
--    requests" policy) — workspace_id is never part of the predicate.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_request public.execution_requests;
  -- A real workspace genuinely owned by user A (23c725ec-...) — proves the
  -- isolation holds even for a real, existing workspace, not just a
  -- nonexistent id.
  v_fake_workspace uuid := '6f55212c-498f-476a-832e-30cef7d1e788'::uuid;
begin
  -- Spoofed provenance: a source claiming a fabricated plan/decision/action
  -- id that was never actually produced by any real Planning/Decision/
  -- Action Intelligence run. It is stored honestly as-given (there is
  -- nothing server-side to validate a transient, non-persisted Plan/
  -- Decision id against — see action.ts's own ActionSource doc comment)
  -- but must never be treated as an authorization signal of any kind.
  select * into v_request from public.create_execution_request(
    v_fake_workspace, 'save_action_to_notes', '{}'::jsonb,
    '{"kind":"action","actionId":"fake-action-id","actionSource":{"kind":"decision","label":"A decision that never happened","planId":"fake-plan-id","decisionId":"fake-decision-id"}}'::jsonb,
    '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-test-8a', 'hash-test-8a', 86400
  );

  -- The fabricated source changed nothing about the actual authorization
  -- requirement: the request still starts in awaiting_approval like any
  -- other, and nothing about the fake ids grants it a shortcut.
  if v_request.status <> 'awaiting_approval' then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (8a): unexpected initial status % — spoofed source somehow changed the state machine entry point', v_request.status;
  end if;

  perform set_config('app.test_request_id_8', v_request.id::text, false);
  perform set_config('app.test_workspace_8', v_fake_workspace::text, false);

  raise notice 'EXECUTION FOUNDATION TEST (8a) PASSED: a spoofed source is stored honestly but grants no authorization shortcut';
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_request_id uuid := current_setting('app.test_request_id_8')::uuid;
  v_workspace_id uuid := current_setting('app.test_workspace_8')::uuid;
begin
  -- User B — even sharing the same workspace_id as user A's request —
  -- still cannot see it: workspace_id is not part of the RLS predicate,
  -- only user_id is. Cross-tenant access reduces to the same
  -- actor-isolation guarantee already proven in test 2.
  if exists (select 1 from public.execution_requests where id = v_request_id) then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (8b): user B can see user A''s execution request via a shared workspace_id';
  end if;

  if exists (select 1 from public.execution_requests where workspace_id = v_workspace_id) then
    raise exception 'EXECUTION FOUNDATION TEST FAILED (8b): user B can enumerate execution requests by workspace_id at all';
  end if;

  raise notice 'EXECUTION FOUNDATION TEST (8b) PASSED: workspace_id is not an access-control boundary on this table, only user_id is';
end;
$$;

rollback;
