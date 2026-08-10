-- ARRIYIA Professional Intelligence — Phase P1: Advanced AI Workspace
-- security test. Phase P1 adds no new table/column/RPC — it reads the
-- existing `workspaces` and `workspace_objectives` tables (via
-- generateWorkspaceBriefing.ts) to build AI prompt context for the new
-- workspace-briefing capability, whose entitlement gate (Free/Pro/
-- Founding Pro) is already covered by
-- pro_intelligence_foundation_security_test.sql and
-- runCapability.test.ts. This file exists to confirm the *data*
-- boundary those two tables already have (owner-only access) still
-- holds for exactly the two tables this new capability directly
-- queries — not to re-test the whole pre-existing collaboration/
-- membership system.
--
-- Same conventions as prior Phase test files: each numbered block is a
-- self-contained `begin; ... rollback;` transaction, `request.jwt.claims`
-- simulates a real authenticated session (no role switch). Users reused
-- from founding_pro_invitation_security_test.sql (same vetted,
-- safe-to-mutate-within-a-rollback set):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co)
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--
-- Deliberately does NOT reuse 5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1
-- (engutoto@gmail.com) or 249c4f9a-fe94-4174-af49-ca38d526caba/
-- 9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 — not needed here, and keeping
-- this file's blast radius to the two users below is simplest to audit.

-- ---------------------------------------------------------------------
-- 1. A user can create their own workspace and add an objective to it
--    (ownership sanity check — the foundation the briefing capability
--    depends on actually works end to end for its owner).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
begin
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'P1 Test Workspace')
    returning id into v_workspace_id;

  insert into public.workspace_objectives (workspace_id, user_id, content, status)
    values (v_workspace_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Ship the P1 test', 'active');

  if not exists (select 1 from public.workspaces where id = v_workspace_id and user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d') then
    raise exception 'WORKSPACE INTELLIGENCE TEST FAILED (1): owner cannot read their own newly created workspace';
  end if;

  if not exists (select 1 from public.workspace_objectives where workspace_id = v_workspace_id and content = 'Ship the P1 test') then
    raise exception 'WORKSPACE INTELLIGENCE TEST FAILED (1): owner cannot read their own newly created objective';
  end if;

  raise notice 'WORKSPACE INTELLIGENCE TEST (1) PASSED: a user can create and read their own workspace and objective';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. Cross-user access denial: another authenticated user cannot see a
--    workspace they do not own or belong to (RLS on workspaces, no
--    ID-manipulation bypass).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
begin
  insert into public.workspaces (user_id, name) values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'P1 Owner-Only Workspace')
    returning id into v_workspace_id;

  perform set_config('request.jwt.claims', '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}', true);

  if exists (select 1 from public.workspaces where id = v_workspace_id) then
    raise exception 'WORKSPACE INTELLIGENCE TEST FAILED (2): a different authenticated user could see another user''s workspace by ID';
  end if;

  raise notice 'WORKSPACE INTELLIGENCE TEST (2) PASSED: a workspace is invisible to a user who does not own it, even by direct ID lookup';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. Cross-user access denial on workspace_objectives (the "objective"
--    context source for the briefing capability) mirrors test 2.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
  v_objective_id uuid;
begin
  insert into public.workspaces (user_id, name) values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'P1 Owner-Only Workspace 2')
    returning id into v_workspace_id;
  insert into public.workspace_objectives (workspace_id, user_id, content, status)
    values (v_workspace_id, '23c725ec-b2d6-487c-8291-dae7a280a291', 'Confidential objective', 'active')
    returning id into v_objective_id;

  perform set_config('request.jwt.claims', '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}', true);

  if exists (select 1 from public.workspace_objectives where id = v_objective_id) then
    raise exception 'WORKSPACE INTELLIGENCE TEST FAILED (3): a different authenticated user could see another user''s workspace objective by ID';
  end if;

  raise notice 'WORKSPACE INTELLIGENCE TEST (3) PASSED: a workspace objective is invisible to a user who does not own its workspace';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Cross-user tamper denial: another authenticated user cannot UPDATE
--    a workspace's name they do not own (guards against an attacker
--    who somehow learns a valid workspace ID trying to corrupt the
--    context the briefing capability would read).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
  v_name_after text;
begin
  insert into public.workspaces (user_id, name) values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'P1 Tamper Target')
    returning id into v_workspace_id;

  perform set_config('request.jwt.claims', '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}', true);

  update public.workspaces set name = 'Tampered' where id = v_workspace_id;

  perform set_config('request.jwt.claims', '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}', true);

  select name into v_name_after from public.workspaces where id = v_workspace_id;

  if v_name_after is distinct from 'P1 Tamper Target' then
    raise exception 'WORKSPACE INTELLIGENCE TEST FAILED (4): a non-owner successfully renamed another user''s workspace';
  end if;

  raise notice 'WORKSPACE INTELLIGENCE TEST (4) PASSED: a non-owner cannot modify another user''s workspace';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Unauthenticated access denial: with no JWT claims set at all
--    (auth.uid() resolves to null, the same state an anonymous request
--    is in), a workspace is not readable by ID.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
begin
  insert into public.workspaces (user_id, name) values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'P1 Unauthenticated Target')
    returning id into v_workspace_id;

  perform set_config('request.jwt.claims', '', true);

  if exists (select 1 from public.workspaces where id = v_workspace_id) then
    raise exception 'WORKSPACE INTELLIGENCE TEST FAILED (5): a workspace was visible with no authenticated session at all';
  end if;

  raise notice 'WORKSPACE INTELLIGENCE TEST (5) PASSED: a workspace is invisible with no authenticated session';
end;
$$;

rollback;
