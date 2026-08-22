-- ARRIYIA — I6 Planning Intelligence security regression test.
--
-- Planning Intelligence has no dedicated persistence table of its own
-- (a Plan is ephemeral unless saved — see savePlanToNote.ts's own doc
-- comment on why generation_metadata.plan on an existing `notes` row is
-- the deliberate seam, not a new `plans` table). Its real security
-- surface is therefore exactly the two existing tables it reads/writes:
--
--   1. `workspace_objectives` — read by buildPlanningContext.ts
--      (listWorkspaceObjectives) for every plan, and written by
--      addPlanItemAsWorkspaceObjective.ts when a user promotes a
--      milestone/task into workspace-level tracking.
--   2. `notes` — written by savePlanToNote.ts, carrying the full
--      structured Plan in generation_metadata.plan.
--
-- `notes` RLS was already given a real, correctly-methodologied
-- regression test in research_intelligence_evidence_security_test.sql
-- (I4) — not reproduced here. `workspace_objectives` DOES already have
-- a cross-user-denial test (workspace_intelligence_security_test.sql,
-- test 3), but that file predates the `set local role authenticated`
-- discovery (document_intelligence_security_test.sql, I3) and says so
-- explicitly in its own header ("no role switch") — meaning it was
-- run, if ever, through a connection that bypasses RLS entirely
-- (rolbypassrls = true for `postgres`/`service_role`), so its own
-- "PASSED" conclusion was never actually proven by that file. This
-- file re-verifies the SAME boundary under the correct methodology —
-- the genuine gap I6 closes here is a false-positive-shaped test, not
-- a real RLS hole (independently confirmed clean via the correct
-- methodology before this file was written) — plus adds a save-to-note
-- write-path check specific to how Planning itself writes a note.
--
-- Rollback-wrapped-transaction convention; every simulated session does
-- `set local role authenticated` explicitly (this connection is
-- `postgres`, rolbypassrls = true).
--
-- Users reused from the same vetted, safe-to-mutate-within-a-rollback
-- set already used elsewhere in this directory:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) — "owner"
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com) — "outsider"

-- ---------------------------------------------------------------------
-- 1. workspace_objectives cross-user SELECT denial, under the correct
--    role-switch methodology (re-verifying workspace_intelligence_
--    security_test.sql's own test 3, whose "no role switch" premise
--    never actually engaged RLS on this connection).
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
  v_objective_id uuid;
begin
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'I6 Planning Owner Workspace')
    returning id into v_workspace_id;
  insert into public.workspace_objectives (workspace_id, user_id, content, status)
    values (v_workspace_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'A plan-derived objective', 'active')
    returning id into v_objective_id;

  if not exists (select 1 from public.workspace_objectives where id = v_objective_id) then
    raise exception 'PLANNING INTELLIGENCE SECURITY TEST FAILED (1): the owner cannot see their own just-inserted workspace objective';
  end if;

  perform set_config('request.jwt.claims', '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}', true);

  if exists (select 1 from public.workspace_objectives where id = v_objective_id) then
    raise exception 'PLANNING INTELLIGENCE SECURITY TEST FAILED (1): a different authenticated user could see another user''s workspace objective — this is what buildPlanningContext.ts''s listWorkspaceObjectives call depends on NOT being possible';
  end if;

  raise notice 'PLANNING INTELLIGENCE SECURITY TEST (1) PASSED: workspace_objectives is genuinely invisible cross-user, under the correct role-switch methodology';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. workspace_objectives cross-user UPDATE denial — addPlanItemAs
--    WorkspaceObjective.ts only ever inserts, but a real tamper-denial
--    check here closes the same gap test 1 closes for SELECT.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_workspace_id uuid;
  v_objective_id uuid;
  v_rows_updated int;
begin
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'I6 Planning Owner Workspace 2')
    returning id into v_workspace_id;
  insert into public.workspace_objectives (workspace_id, user_id, content, status)
    values (v_workspace_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Another plan-derived objective', 'active')
    returning id into v_objective_id;

  perform set_config('request.jwt.claims', '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}', true);

  update public.workspace_objectives set content = 'tampered by outsider' where id = v_objective_id;
  get diagnostics v_rows_updated = row_count;

  if v_rows_updated <> 0 then
    raise exception 'PLANNING INTELLIGENCE SECURITY TEST FAILED (2): a different authenticated user updated % row(s) of another user''s workspace objective', v_rows_updated;
  end if;

  raise notice 'PLANNING INTELLIGENCE SECURITY TEST (2) PASSED: a different authenticated user cannot tamper with another user''s workspace objective';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A note written the way savePlanToNote.ts actually writes one (real
--    generation_metadata.plan JSON shape, not a placeholder) is owner-
--    visible and cross-user-denied — the save-to-notes write path I6
--    itself is the first to exercise for this specific shape.
-- ---------------------------------------------------------------------

begin;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_note_id uuid;
begin
  insert into public.notes (user_id, title, content, generation_metadata)
    values (
      '313866d5-4ab7-4d65-bda9-67b9bd668f2d',
      'ARRIYIA University Pilot Launch Plan',
      '# ARRIYIA University Pilot Launch Plan',
      jsonb_build_object(
        'creationMethod', 'ai_generated',
        'artifactKind', 'report',
        'objective', 'Launch a pilot of ARRIYIA at a university',
        'planId', gen_random_uuid(),
        'plan', jsonb_build_object('title', 'ARRIYIA University Pilot Launch Plan', 'status', 'complete')
      )
    )
    returning id into v_note_id;

  if not exists (select 1 from public.notes where id = v_note_id and generation_metadata->>'creationMethod' = 'ai_generated') then
    raise exception 'PLANNING INTELLIGENCE SECURITY TEST FAILED (3): the owner cannot see their own just-saved plan note';
  end if;

  perform set_config('request.jwt.claims', '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}', true);

  if exists (select 1 from public.notes where id = v_note_id) then
    raise exception 'PLANNING INTELLIGENCE SECURITY TEST FAILED (3): a different authenticated user could see another user''s saved plan note';
  end if;

  raise notice 'PLANNING INTELLIGENCE SECURITY TEST (3) PASSED: a saved plan note is owner-visible and cross-user-denied';
end;
$$;

rollback;
