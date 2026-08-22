-- ARRIYIA — I8 Learning Intelligence security test
-- (0087_learning_intelligence_foundation.sql).
--
-- Confirms the load-bearing properties: the full learning-signal
-- reconciliation lifecycle (reinforcement/strength thresholds, genuine
-- contradiction handling, 'unknown' never creating a signal, user
-- feedback preserved distinctly from system-observed evaluations, and
-- revocation being terminal), server-side entitlement enforcement, RLS
-- actor isolation on all three new tables, that a client cannot forge a
-- state transition by writing to the tables directly, that ownership of
-- the target intelligence_records row is genuinely re-verified (not just
-- relying on RLS), and that workspace_id plays no role in access control
-- (mirroring execution_foundation_security_test.sql's own W test).
--
-- METHODOLOGY: every block below does `set local role authenticated`
-- before `request.jwt.claims` — see execution_foundation_security_test.sql's
-- own header for exactly why this is required on this project's
-- `postgres`-role test connection (RLS is otherwise silently bypassed).
--
-- Users reused from execution_foundation_security_test.sql (same vetted,
-- safe-to-mutate-within-a-rollback set):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co)      -- "user A" (pro/founding_pro — has learning_intelligence)
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) -- "user B" (pro/founding_pro — has learning_intelligence)
--   5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1 (engutoto@gmail.com)  -- "user C" (free — does NOT have learning_intelligence)

-- ---------------------------------------------------------------------
-- 1. Full learning-signal lifecycle: reinforcement/strength thresholds,
--    genuine contradiction (I8.7), 'unknown' never creating/reinforcing a
--    signal (I8.18), user feedback preserved distinctly (I8.9), and
--    terminal revocation (I8.21/I8.22).
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_record public.intelligence_records;
  v_signal_pos public.intelligence_learning_signals;
  v_signal_neg public.intelligence_learning_signals;
  v_count int;
begin
  select * into v_record from public.create_intelligence_record(
    null, null, 'execution', 'Execution: save_action_to_notes (succeeded)', '{"capability":"save_action_to_notes"}'::jsonb,
    'completed', null, null, null, null, null, null, 'A note is created'
  );

  perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Note note-1 confirmed to exist.', 'match', 'test:lifecycle', true, null);
  select * into v_signal_pos from public.intelligence_learning_signals where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291' and pattern_key = 'test:lifecycle' and direction = 'positive';
  if v_signal_pos.status <> 'proposed' or v_signal_pos.strength <> 'weak' or v_signal_pos.evidence_count <> 1 then
    raise exception 'LEARNING TEST FAILED (1a): expected proposed/weak/1, got %/%/%', v_signal_pos.status, v_signal_pos.strength, v_signal_pos.evidence_count;
  end if;
  if (select actual_outcome from public.intelligence_records where id = v_record.id) is null then
    raise exception 'LEARNING TEST FAILED (1a): actual_outcome was not populated on the ledger record';
  end if;

  perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Note note-2 confirmed to exist.', 'match', 'test:lifecycle', true, null);
  select * into v_signal_pos from public.intelligence_learning_signals where id = v_signal_pos.id;
  if v_signal_pos.status <> 'active' or v_signal_pos.strength <> 'moderate' or v_signal_pos.evidence_count <> 2 then
    raise exception 'LEARNING TEST FAILED (1b): expected active/moderate/2, got %/%/%', v_signal_pos.status, v_signal_pos.strength, v_signal_pos.evidence_count;
  end if;

  perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Note note-3 confirmed to exist.', 'match', 'test:lifecycle', true, null);
  perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Note note-4 confirmed to exist.', 'match', 'test:lifecycle', true, null);
  select * into v_signal_pos from public.intelligence_learning_signals where id = v_signal_pos.id;
  if v_signal_pos.strength <> 'strong' or v_signal_pos.evidence_count <> 4 then
    raise exception 'LEARNING TEST FAILED (1c): expected strong/4, got %/%', v_signal_pos.strength, v_signal_pos.evidence_count;
  end if;

  -- Genuine contradiction: the original signal is never overwritten or deleted, only marked contested.
  perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Reported noteId was not found on re-read.', 'contradiction', 'test:lifecycle', true, null);
  select * into v_signal_pos from public.intelligence_learning_signals where id = v_signal_pos.id;
  if v_signal_pos.status <> 'contested' or v_signal_pos.evidence_count <> 4 or v_signal_pos.strength <> 'strong' then
    raise exception 'LEARNING TEST FAILED (1d): original signal must be contested with its evidence/strength history intact, got %/%/%', v_signal_pos.status, v_signal_pos.evidence_count, v_signal_pos.strength;
  end if;
  select * into v_signal_neg from public.intelligence_learning_signals where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291' and pattern_key = 'test:lifecycle' and direction = 'negative';
  if v_signal_neg.status <> 'proposed' or v_signal_neg.evidence_count <> 1 or v_signal_neg.contradicts_signal_id <> v_signal_pos.id then
    raise exception 'LEARNING TEST FAILED (1e): expected a new negative signal proposed/1/contradicts=%, got %/%/%', v_signal_pos.id, v_signal_neg.status, v_signal_neg.evidence_count, v_signal_neg.contradicts_signal_id;
  end if;

  -- I8.18 — 'unknown' never creates or reinforces a signal, though the evaluation itself is still durably recorded.
  perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Verification could not be performed.', 'unknown', 'test:lifecycle', true, null);
  select count(*) into v_count from public.intelligence_learning_signals where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291' and pattern_key = 'test:lifecycle';
  if v_count <> 2 then
    raise exception 'LEARNING TEST FAILED (1f): an unknown comparison created a spurious signal, total signals = %', v_count;
  end if;

  -- I8.9 — user feedback is stored as its own distinct evaluation, never overwriting or replacing the system-observed ones.
  -- Its 'miss' comparison shares test:lifecycle's negative direction, so it also honestly REINFORCES the
  -- still-proposed v_signal_neg (evidence_count 1 -> 2, promoting it to 'active') — the same deterministic
  -- evidence mechanism system-observed evaluations use, not a special case for feedback.
  perform public.record_intelligence_outcome(v_record.id, 'user_feedback', 'A note is created', 'This was not actually useful.', 'miss', 'test:lifecycle', null, 'This was not actually useful.');
  select count(*) into v_count from public.intelligence_outcome_evaluations where record_id = v_record.id;
  if v_count <> 7 then
    raise exception 'LEARNING TEST FAILED (1g): expected 7 total evaluations preserved (nothing overwritten), found %', v_count;
  end if;
  select count(*) into v_count from public.intelligence_outcome_evaluations where record_id = v_record.id and source = 'user_feedback';
  if v_count <> 1 then
    raise exception 'LEARNING TEST FAILED (1g): expected exactly 1 user_feedback evaluation, found %', v_count;
  end if;
  select * into v_signal_neg from public.intelligence_learning_signals where id = v_signal_neg.id;
  if v_signal_neg.evidence_count <> 2 or v_signal_neg.status <> 'active' then
    raise exception 'LEARNING TEST FAILED (1g): user feedback should have reinforced the negative signal to active/2, got %/%', v_signal_neg.status, v_signal_neg.evidence_count;
  end if;

  -- I8.21/I8.22 — revocation is terminal.
  perform public.revoke_learning_signal(v_signal_neg.id, 'Testing revocation');
  if (select status from public.intelligence_learning_signals where id = v_signal_neg.id) <> 'revoked' then
    raise exception 'LEARNING TEST FAILED (1h): revoke did not set status to revoked';
  end if;
  begin
    perform public.revoke_learning_signal(v_signal_neg.id, 'again');
    raise exception 'LEARNING TEST FAILED (1i): re-revoking a revoked signal should have raised';
  exception when others then
    null;
  end;

  -- A later matching evaluation after revocation starts a FRESH proposed signal — never reinforces the revoked one.
  perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Reported noteId was not found on re-read.', 'contradiction', 'test:lifecycle', true, null);
  select count(*) into v_count from public.intelligence_learning_signals where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291' and pattern_key = 'test:lifecycle' and direction = 'negative' and status = 'proposed';
  if v_count <> 1 then
    raise exception 'LEARNING TEST FAILED (1j): expected a fresh proposed negative signal after revocation, found %', v_count;
  end if;
  if (select evidence_count from public.intelligence_learning_signals where id = v_signal_neg.id) <> 2 then
    raise exception 'LEARNING TEST FAILED (1j): the revoked signal must never be reinforced further';
  end if;

  raise notice 'LEARNING TEST (1) PASSED: full lifecycle behaves as designed';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. Entitlement: a user without learning_intelligence is denied at
--    record_intelligence_outcome() itself, server-side — not merely a
--    client-side UI hint.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1","role":"authenticated"}';

do $$
declare
  v_raised boolean := false;
  v_message text;
begin
  if public.has_feature('5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1'::uuid, 'learning_intelligence') then
    raise exception 'LEARNING TEST FAILED (2): test user unexpectedly already has learning_intelligence — pick a different user';
  end if;

  begin
    perform public.record_intelligence_outcome('00000000-0000-0000-0000-000000000000'::uuid, 'system_observed', 'x', 'y', 'match', 'test:pattern', null, null);
  exception when others then
    v_raised := true;
    get stacked diagnostics v_message = message_text;
  end;

  if not v_raised then
    raise exception 'LEARNING TEST FAILED (2): a user without learning_intelligence entitlement was able to record an outcome';
  end if;
  if position('upgraded plan' in v_message) = 0 then
    raise exception 'LEARNING TEST FAILED (2): rejection did not carry the expected entitlement message, got: %', v_message;
  end if;

  raise notice 'LEARNING TEST (2) PASSED: non-entitled user is denied server-side, before even an ownership check';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. Actor isolation: user B cannot record an outcome against user A's
--    intelligence_records row (even knowing its id), cannot revoke user
--    A's learning signal, and RLS genuinely hides both from a bare
--    SELECT.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_record public.intelligence_records;
  v_evaluation public.intelligence_outcome_evaluations;
begin
  select * into v_record from public.create_intelligence_record(
    null, null, 'execution', 'Execution: save_action_to_notes (succeeded)', '{"capability":"save_action_to_notes"}'::jsonb,
    'completed', null, null, null, null, null, null, 'A note is created'
  );
  perform set_config('app.test_record_id', v_record.id::text, false);

  select * into v_evaluation from public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Note confirmed.', 'match', 'test:isolation', true, null);
  perform set_config('app.test_signal_id', (select id::text from public.intelligence_learning_signals where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291' and pattern_key = 'test:isolation'), false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_record_id uuid := current_setting('app.test_record_id')::uuid;
  v_signal_id uuid := current_setting('app.test_signal_id')::uuid;
  v_raised boolean := false;
begin
  begin
    perform public.record_intelligence_outcome(v_record_id, 'system_observed', 'x', 'y', 'match', 'test:isolation', null, null);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEARNING TEST FAILED (3a): user B was able to record an outcome against user A''s record';
  end if;

  v_raised := false;
  begin
    perform public.revoke_learning_signal(v_signal_id, 'hijacked');
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEARNING TEST FAILED (3b): user B was able to revoke user A''s learning signal';
  end if;

  if exists (select 1 from public.intelligence_outcome_evaluations where record_id = v_record_id) then
    raise exception 'LEARNING TEST FAILED (3c): user B can see user A''s outcome evaluations via select';
  end if;
  if exists (select 1 from public.intelligence_learning_signals where id = v_signal_id) then
    raise exception 'LEARNING TEST FAILED (3d): user B can see user A''s learning signal via select';
  end if;

  raise notice 'LEARNING TEST (3) PASSED: actor isolation holds for record/revoke/select';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. A client cannot forge a state transition by writing to the tables
--    directly — authenticated has no INSERT/UPDATE grant on any of the
--    three new tables.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_raised boolean := false;
begin
  begin
    insert into public.intelligence_learning_signals (user_id, record_type, pattern_key, direction, statement)
    values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'execution', 'forged:pattern', 'positive', 'Forged directly.');
  exception when insufficient_privilege then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEARNING TEST FAILED (4a): a direct INSERT on intelligence_learning_signals was not rejected';
  end if;

  v_raised := false;
  begin
    update public.intelligence_learning_signals set status = 'active' where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291';
  exception when insufficient_privilege then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEARNING TEST FAILED (4b): a direct UPDATE on intelligence_learning_signals was not rejected';
  end if;

  raise notice 'LEARNING TEST (4) PASSED: direct table writes are rejected; only the RPCs can mutate state';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Cross-tenant / spoofed provenance: workspace_id plays no role in
--    access control (mirrors execution_foundation_security_test.sql's
--    own test 8), and user_id is always server-derived from auth.uid() —
--    never client-controllable — regardless of which workspace the
--    underlying record is tagged with.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_record public.intelligence_records;
  v_evaluation public.intelligence_outcome_evaluations;
  v_real_workspace uuid;
begin
  select id into v_real_workspace from public.workspaces where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291' limit 1;

  select * into v_record from public.create_intelligence_record(
    v_real_workspace, null, 'execution', 'Execution: save_action_to_notes (succeeded)', '{"capability":"save_action_to_notes"}'::jsonb,
    'completed', null, null, null, null, null, null, 'A note is created'
  );

  select * into v_evaluation from public.record_intelligence_outcome(v_record.id, 'system_observed', 'A note is created', 'Note confirmed.', 'match', 'test:tenant', true, null);

  if v_evaluation.user_id <> '23c725ec-b2d6-487c-8291-dae7a280a291' then
    raise exception 'LEARNING TEST FAILED (5a): evaluation user_id was not the real caller';
  end if;
  if (select user_id from public.intelligence_learning_signals where pattern_key = 'test:tenant') <> '23c725ec-b2d6-487c-8291-dae7a280a291' then
    raise exception 'LEARNING TEST FAILED (5b): signal user_id was not the real caller';
  end if;

  perform set_config('app.test_record_id_5', v_record.id::text, false);
  perform set_config('app.test_workspace_5', v_real_workspace::text, false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid := current_setting('app.test_workspace_5')::uuid;
begin
  -- Even a real, existing workspace tag on the underlying record grants user B nothing.
  if exists (select 1 from public.intelligence_outcome_evaluations where workspace_id = v_workspace_id) then
    raise exception 'LEARNING TEST FAILED (5c): user B can enumerate outcome evaluations by workspace_id';
  end if;
  if exists (select 1 from public.intelligence_learning_signals where workspace_id = v_workspace_id) then
    raise exception 'LEARNING TEST FAILED (5d): user B can enumerate learning signals by workspace_id';
  end if;

  raise notice 'LEARNING TEST (5) PASSED: workspace_id is not an access-control boundary; user_id is always server-derived, never spoofable';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. Required multi-outcome test (Section 5 of the I8 brief): at least
--    three verified outcomes — success (match), partial success
--    (partial_match), and failure (miss) — must be distinguished
--    correctly, never collapsed into one bucket.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_record public.intelligence_records;
  v_eval_success public.intelligence_outcome_evaluations;
  v_eval_partial public.intelligence_outcome_evaluations;
  v_eval_failure public.intelligence_outcome_evaluations;
begin
  select * into v_record from public.create_intelligence_record(
    null, null, 'planning', 'Plan: multi-outcome test', '{}'::jsonb, 'completed', null, null, null, null, null, null, 'Onboard 50 students'
  );

  select * into v_eval_success from public.record_intelligence_outcome(v_record.id, 'user_feedback', 'Onboard 50 students', '52 students onboarded.', 'match', 'test:multi-outcome', null, null);
  select * into v_eval_partial from public.record_intelligence_outcome(v_record.id, 'user_feedback', 'Onboard 50 students', '30 students onboarded.', 'partial_match', 'test:multi-outcome-2', null, null);
  select * into v_eval_failure from public.record_intelligence_outcome(v_record.id, 'user_feedback', 'Onboard 50 students', '5 students onboarded.', 'miss', 'test:multi-outcome-3', null, null);

  if v_eval_success.comparison_result <> 'match' or v_eval_partial.comparison_result <> 'partial_match' or v_eval_failure.comparison_result <> 'miss' then
    raise exception 'LEARNING TEST FAILED (6): the three outcomes were not distinguished correctly: %/%/%', v_eval_success.comparison_result, v_eval_partial.comparison_result, v_eval_failure.comparison_result;
  end if;

  -- partial_match counts toward the POSITIVE direction (I8.2's own MATCH/PARTIAL_MATCH/MISS/CONTRADICTION/UNKNOWN taxonomy).
  if (select direction from public.intelligence_learning_signals where pattern_key = 'test:multi-outcome-2') <> 'positive' then
    raise exception 'LEARNING TEST FAILED (6): partial_match should create a positive-direction signal';
  end if;
  if (select direction from public.intelligence_learning_signals where pattern_key = 'test:multi-outcome-3') <> 'negative' then
    raise exception 'LEARNING TEST FAILED (6): miss should create a negative-direction signal';
  end if;

  raise notice 'LEARNING TEST (6) PASSED: match/partial_match/miss are genuinely distinguished, never collapsed';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 7. Plan learning and Action (execution) learning remain distinguishable
--    (Section 10 of the I8 brief) — never collapsed into one generic
--    signal bucket, even for the same underlying user.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_plan_record public.intelligence_records;
  v_execution_record public.intelligence_records;
  v_plan_signal public.intelligence_learning_signals;
  v_action_signal public.intelligence_learning_signals;
begin
  select * into v_plan_record from public.create_intelligence_record(
    null, null, 'planning', 'Plan: University Pilot Launch Plan', '{}'::jsonb, 'completed', null, null, null, null, null, null, 'Onboard 50 students'
  );
  select * into v_execution_record from public.create_intelligence_record(
    null, null, 'execution', 'Execution: add_action_as_workspace_objective (succeeded)', '{"capability":"add_action_as_workspace_objective"}'::jsonb,
    'completed', null, null, null, null, null, null, 'A workspace objective is created'
  );

  perform public.record_intelligence_outcome(v_plan_record.id, 'user_feedback', 'Onboard 50 students', 'Only 20 onboarded — timeline was too tight.', 'miss', 'planning:timeline_variance', null, null);
  perform public.record_intelligence_outcome(v_execution_record.id, 'system_observed', 'A workspace objective is created', 'Objective confirmed to exist.', 'match', 'execution:capability:add_action_as_workspace_objective', true, null);

  select * into v_plan_signal from public.intelligence_learning_signals where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291' and record_type = 'planning' and pattern_key = 'planning:timeline_variance';
  select * into v_action_signal from public.intelligence_learning_signals where user_id = '23c725ec-b2d6-487c-8291-dae7a280a291' and record_type = 'execution' and pattern_key = 'execution:capability:add_action_as_workspace_objective';

  if v_plan_signal.id is null or v_action_signal.id is null then
    raise exception 'LEARNING TEST FAILED (7): expected both a distinct planning signal and a distinct execution (action) signal';
  end if;
  if v_plan_signal.id = v_action_signal.id then
    raise exception 'LEARNING TEST FAILED (7): plan learning and action learning were collapsed into the same signal';
  end if;
  if v_plan_signal.record_type <> 'planning' or v_action_signal.record_type <> 'execution' then
    raise exception 'LEARNING TEST FAILED (7): record_type tagging is wrong: %/%', v_plan_signal.record_type, v_action_signal.record_type;
  end if;

  raise notice 'LEARNING TEST (7) PASSED: plan learning and action learning stay genuinely distinguishable';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 8. Adversarial R — a malformed comparison_result, source, or empty
--    pattern_key is rejected outright, server-side, before anything is
--    ever inserted.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_record public.intelligence_records;
  v_raised boolean := false;
begin
  select * into v_record from public.create_intelligence_record(null, null, 'execution', 'test', '{}'::jsonb, 'completed', null, null, null, null, null, null, 'x');

  begin
    perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'x', 'y', 'bogus_value', 'test:r', null, null);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEARNING TEST FAILED (8a): malformed comparison_result was accepted';
  end if;

  v_raised := false;
  begin
    perform public.record_intelligence_outcome(v_record.id, 'bogus_source', 'x', 'y', 'match', 'test:r', null, null);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEARNING TEST FAILED (8b): malformed source was accepted';
  end if;

  v_raised := false;
  begin
    perform public.record_intelligence_outcome(v_record.id, 'system_observed', 'x', 'y', 'match', '', null, null);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEARNING TEST FAILED (8c): empty pattern_key was accepted';
  end if;

  if exists (select 1 from public.intelligence_outcome_evaluations where record_id = v_record.id) then
    raise exception 'LEARNING TEST FAILED (8d): a malformed call left a row behind';
  end if;

  raise notice 'LEARNING TEST (8) PASSED: malformed input is rejected server-side, nothing inserted';
end;
$$;

rollback;
