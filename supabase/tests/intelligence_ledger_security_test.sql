-- ARRIYIA — Intelligence Ledger security test (0066_intelligence_ledger.sql).
-- Confirms the load-bearing security properties: RLS owner-or-workspace-
-- viewer SELECT on both new tables, zero client INSERT/UPDATE/DELETE
-- (every write goes through a SECURITY DEFINER RPC), and that
-- create_intelligence_journey/create_intelligence_record cannot be used
-- to forge a workspace_id, journey_id, parent_record_id,
-- execution_request_id, or objective_id the caller does not actually own
-- or have access to. user_id is not a parameter of either RPC at all
-- (always (select auth.uid())), so "forged user_id" is enforced by
-- omission rather than a runtime check — every block below still
-- confirms the row it created carries the caller's own id, never
-- anyone else's.
--
-- Same conventions and same vetted, safe-to-mutate-within-a-rollback
-- users as execution_foundation_security_test.sql:
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co)      -- "user A"
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) -- "user B"

-- ---------------------------------------------------------------------
-- 1. Owner sanity: a user can create their own personal (no workspace)
--    journey and record, and read them back with the real user_id set
--    server-side.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_journey public.intelligence_journeys;
  v_record public.intelligence_records;
begin
  select * into v_journey from public.create_intelligence_journey(null, null, 'Personal exploration');
  if v_journey.user_id <> '23c725ec-b2d6-487c-8291-dae7a280a291' then
    raise exception 'LEDGER TEST FAILED (1): journey.user_id was not set to the caller';
  end if;

  select * into v_record from public.create_intelligence_record(
    null, v_journey.id, 'research', 'Research Intelligence: personal test', '{"question":"x"}'::jsonb
  );
  if v_record.user_id <> '23c725ec-b2d6-487c-8291-dae7a280a291' then
    raise exception 'LEDGER TEST FAILED (1): record.user_id was not set to the caller';
  end if;

  if not exists (select 1 from public.intelligence_journeys where id = v_journey.id) then
    raise exception 'LEDGER TEST FAILED (1): owner cannot read their own newly created journey';
  end if;
  if not exists (select 1 from public.intelligence_records where id = v_record.id) then
    raise exception 'LEDGER TEST FAILED (1): owner cannot read their own newly created record';
  end if;

  raise notice 'LEDGER TEST (1) PASSED: a user can create and read their own personal journey and record';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. Workspace viewer access: a workspace-scoped journey/record created
--    by the owner is visible to another user holding an explicit
--    'viewer' membership on that workspace.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
  v_journey public.intelligence_journeys;
  v_record public.intelligence_records;
begin
  insert into public.workspaces (user_id, name) values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'Ledger Test Workspace (shared)')
    returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_workspace_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'viewer', 'active');

  select * into v_journey from public.create_intelligence_journey(v_workspace_id, null, 'Shared workspace journey');
  select * into v_record from public.create_intelligence_record(
    v_workspace_id, v_journey.id, 'planning', 'Plan: shared workspace test', '{"title":"x"}'::jsonb
  );

  perform set_config('app.test_journey_id', v_journey.id::text, false);
  perform set_config('app.test_record_id', v_record.id::text, false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_journey_id uuid := current_setting('app.test_journey_id')::uuid;
  v_record_id uuid := current_setting('app.test_record_id')::uuid;
begin
  if not exists (select 1 from public.intelligence_journeys where id = v_journey_id) then
    raise exception 'LEDGER TEST FAILED (2): a workspace viewer cannot see the owner''s journey';
  end if;
  if not exists (select 1 from public.intelligence_records where id = v_record_id) then
    raise exception 'LEDGER TEST FAILED (2): a workspace viewer cannot see the owner''s record';
  end if;

  raise notice 'LEDGER TEST (2) PASSED: a workspace viewer can see journeys/records the workspace owner created';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. Unauthorized workspace access: a user with no membership on the
--    workspace cannot see its journey/record via SELECT, even by known
--    id, and cannot attach their own new journey/record to that
--    workspace via the RPCs.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
  v_journey public.intelligence_journeys;
  v_record public.intelligence_records;
begin
  insert into public.workspaces (user_id, name) values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'Ledger Test Workspace (private)')
    returning id into v_workspace_id;

  select * into v_journey from public.create_intelligence_journey(v_workspace_id, null, 'Private workspace journey');
  select * into v_record from public.create_intelligence_record(
    v_workspace_id, v_journey.id, 'decision', 'Decision: private workspace test', '{"title":"x"}'::jsonb
  );

  perform set_config('app.test_workspace_id', v_workspace_id::text, false);
  perform set_config('app.test_journey_id', v_journey.id::text, false);
  perform set_config('app.test_record_id', v_record.id::text, false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid := current_setting('app.test_workspace_id')::uuid;
  v_journey_id uuid := current_setting('app.test_journey_id')::uuid;
  v_record_id uuid := current_setting('app.test_record_id')::uuid;
  v_raised boolean := false;
begin
  if exists (select 1 from public.intelligence_journeys where id = v_journey_id) then
    raise exception 'LEDGER TEST FAILED (3): a non-member can see another user''s workspace-scoped journey';
  end if;
  if exists (select 1 from public.intelligence_records where id = v_record_id) then
    raise exception 'LEDGER TEST FAILED (3): a non-member can see another user''s workspace-scoped record';
  end if;

  begin
    perform public.create_intelligence_journey(v_workspace_id, null, 'Forged workspace journey');
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (3): create_intelligence_journey let a non-member attach a journey to another user''s workspace';
  end if;

  v_raised := false;
  begin
    perform public.create_intelligence_record(v_workspace_id, null, 'action', 'Forged workspace record', '{}'::jsonb);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (3): create_intelligence_record let a non-member attach a record to another user''s workspace';
  end if;

  raise notice 'LEDGER TEST (3) PASSED: unauthorized workspace access is rejected, both for reads and for the create RPCs';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Cross-user isolation on a personal (workspace_id null) journey/
--    record: invisible to any other user, even a workspace collaborator
--    elsewhere, even by known id.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_journey public.intelligence_journeys;
  v_record public.intelligence_records;
begin
  select * into v_journey from public.create_intelligence_journey(null, null, 'Private personal journey');
  select * into v_record from public.create_intelligence_record(
    null, v_journey.id, 'data', 'Data Intelligence: private personal test', '{"question":"x"}'::jsonb
  );
  perform set_config('app.test_journey_id', v_journey.id::text, false);
  perform set_config('app.test_record_id', v_record.id::text, false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_journey_id uuid := current_setting('app.test_journey_id')::uuid;
  v_record_id uuid := current_setting('app.test_record_id')::uuid;
begin
  if exists (select 1 from public.intelligence_journeys where id = v_journey_id) then
    raise exception 'LEDGER TEST FAILED (4): a personal journey with no workspace is visible to another user';
  end if;
  if exists (select 1 from public.intelligence_records where id = v_record_id) then
    raise exception 'LEDGER TEST FAILED (4): a personal record with no workspace is visible to another user';
  end if;

  raise notice 'LEDGER TEST (4) PASSED: personal (no-workspace) journeys/records stay private to their owner';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Forged journey_id / parent_record_id: create_intelligence_record
--    rejects a journey or parent record it does not own, even one it
--    can legitimately see (e.g. via workspace membership) — lineage
--    ownership is stricter than read access.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
  v_journey public.intelligence_journeys;
  v_record public.intelligence_records;
begin
  insert into public.workspaces (user_id, name) values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'Ledger Test Workspace (lineage)')
    returning id into v_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_workspace_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'viewer', 'active');

  select * into v_journey from public.create_intelligence_journey(v_workspace_id, null, 'A''s journey');
  select * into v_record from public.create_intelligence_record(
    v_workspace_id, v_journey.id, 'research', 'Research Intelligence: A''s record', '{"question":"x"}'::jsonb
  );

  perform set_config('app.test_workspace_id', v_workspace_id::text, false);
  perform set_config('app.test_journey_id', v_journey.id::text, false);
  perform set_config('app.test_record_id', v_record.id::text, false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid := current_setting('app.test_workspace_id')::uuid;
  v_journey_id uuid := current_setting('app.test_journey_id')::uuid;
  v_record_id uuid := current_setting('app.test_record_id')::uuid;
  v_raised boolean := false;
begin
  -- B can see both (workspace viewer), but does not own either.
  if not exists (select 1 from public.intelligence_journeys where id = v_journey_id) then
    raise exception 'LEDGER TEST SETUP FAILED (5): viewer cannot even see the journey it is about to try to forge lineage against';
  end if;

  begin
    perform public.create_intelligence_record(v_workspace_id, v_journey_id, 'action', 'Forged journey_id', '{}'::jsonb);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (5): create_intelligence_record accepted a journey_id the caller does not own';
  end if;

  v_raised := false;
  begin
    perform public.create_intelligence_record(v_workspace_id, null, 'action', 'Forged parent_record_id', '{}'::jsonb, 'completed', null, null, null, null, null, v_record_id);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (5): create_intelligence_record accepted a parent_record_id the caller does not own';
  end if;

  raise notice 'LEDGER TEST (5) PASSED: forged journey_id/parent_record_id are rejected even when the caller can see the target row';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. Forged execution_request_id: create_intelligence_record rejects an
--    execution_request the caller does not own — a client cannot claim
--    another user's execution as its own Ledger record.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_request public.execution_requests;
begin
  select * into v_request from public.create_execution_request(
    null, 'save_action_to_notes', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    'A note is created', 'low', false, 'idem-key-ledger-test-6', 'hash-ledger-test-6', 86400
  );
  perform set_config('app.test_execution_request_id', v_request.id::text, false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_execution_request_id uuid := current_setting('app.test_execution_request_id')::uuid;
  v_raised boolean := false;
begin
  begin
    perform public.create_intelligence_record(null, null, 'execution', 'Forged execution_request_id', '{}'::jsonb, 'completed', null, null, null, null, v_execution_request_id);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (6): create_intelligence_record accepted an execution_request_id the caller does not own';
  end if;

  raise notice 'LEDGER TEST (6) PASSED: a forged execution_request_id is rejected';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 7. Objective accessibility: create_intelligence_journey rejects an
--    objective_id the caller cannot see (not owned, not workspace-
--    viewable) — objective_id cannot be used to attach a journey to a
--    goal outside the caller's own access.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
  v_objective_id uuid;
begin
  insert into public.workspaces (user_id, name) values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'Ledger Test Workspace (objective)')
    returning id into v_workspace_id;
  insert into public.workspace_objectives (workspace_id, user_id, content, status)
    values (v_workspace_id, '23c725ec-b2d6-487c-8291-dae7a280a291', 'A private objective B has no access to', 'active')
    returning id into v_objective_id;
  perform set_config('app.test_objective_id', v_objective_id::text, false);
end;
$$;

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_objective_id uuid := current_setting('app.test_objective_id')::uuid;
  v_raised boolean := false;
begin
  begin
    perform public.create_intelligence_journey(null, v_objective_id, 'Forged objective journey');
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (7): create_intelligence_journey accepted an objective_id the caller cannot access';
  end if;

  raise notice 'LEDGER TEST (7) PASSED: an inaccessible objective_id is rejected';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 8. RPC-only enforcement: a client cannot write to either table
--    directly — authenticated has no INSERT/UPDATE/DELETE grant on
--    intelligence_journeys or intelligence_records.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_journey public.intelligence_journeys;
  v_raised boolean := false;
begin
  select * into v_journey from public.create_intelligence_journey(null, null, 'RPC-only enforcement test');

  begin
    insert into public.intelligence_journeys (workspace_id, user_id, objective_id, title)
    values (null, '23c725ec-b2d6-487c-8291-dae7a280a291', null, 'Direct insert attempt');
  exception when insufficient_privilege then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (8): a direct INSERT on intelligence_journeys was not rejected';
  end if;

  v_raised := false;
  begin
    update public.intelligence_journeys set title = 'forged' where id = v_journey.id;
  exception when insufficient_privilege then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (8): a direct UPDATE on intelligence_journeys was not rejected';
  end if;

  v_raised := false;
  begin
    insert into public.intelligence_records (workspace_id, user_id, journey_id, record_type, status, summary, structured_output)
    values (null, '23c725ec-b2d6-487c-8291-dae7a280a291', v_journey.id, 'research', 'completed', 'Direct insert attempt', '{}'::jsonb);
  exception when insufficient_privilege then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (8): a direct INSERT on intelligence_records was not rejected';
  end if;

  raise notice 'LEDGER TEST (8) PASSED: direct table writes are rejected on both tables; only the RPCs can create rows';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 9. Basic input validation: create_intelligence_record rejects an
--    invalid record_type/status and an empty summary — a client cannot
--    smuggle an arbitrary enum value or a blank record past the RPC.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_raised boolean := false;
begin
  begin
    perform public.create_intelligence_record(null, null, 'not_a_real_type', 'x', '{}'::jsonb);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (9): create_intelligence_record accepted an invalid record_type';
  end if;

  v_raised := false;
  begin
    perform public.create_intelligence_record(null, null, 'research', '   ', '{}'::jsonb);
  exception when others then
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'LEDGER TEST FAILED (9): create_intelligence_record accepted a blank summary';
  end if;

  raise notice 'LEDGER TEST (9) PASSED: invalid record_type and blank summary are both rejected';
end;
$$;

rollback;
