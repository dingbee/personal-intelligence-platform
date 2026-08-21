-- ARRIYIA — I4 Research Intelligence evidence-security test.
--
-- Research Intelligence's own evidence-acquisition function
-- (gatherEvidence.ts) reads three sources: documents (via retrieveContext,
-- covered by document_intelligence_security_test.sql, I3), notes (via
-- retrieveNoteContext), and assets (via retrieveAssetContext, out of this
-- file's scope). `notes` RLS was verified by reading the live policy SQL
-- directly (the identical owner-or-workspace-role OR-clause `documents`
-- already has) but — like `documents` before I3 — had no checked-in,
-- runnable regression test of its own. This file adds one, so "a
-- research investigation can never turn an unauthorized note into
-- evidence" has real, automated proof, not just a reading of the policy.
--
-- Same rollback-wrapped-transaction convention as every other file in
-- this directory. Critically, every simulated authenticated session here
-- also does `set local role authenticated` explicitly — this connection
-- is `postgres`, which has `rolbypassrls = true`, so RLS is only actually
-- evaluated once the role itself is switched to one that doesn't bypass
-- it (see document_intelligence_security_test.sql's header comment for
-- the full explanation of why `request.jwt.claims` alone is not enough).
--
-- Users reused from the same vetted, safe-to-mutate-within-a-rollback set:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) — "owner"
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com) — "outsider" / "viewer"

-- ---------------------------------------------------------------------
-- 1. The owner can select their own note — the case gatherEvidence.ts
--    depends on for a legitimate research investigation.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_note_id uuid;
begin
  insert into public.notes (user_id, title, content)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Research note', 'Some findings.')
    returning id into v_note_id;

  if not exists (select 1 from public.notes where id = v_note_id) then
    raise exception 'RESEARCH EVIDENCE SECURITY TEST FAILED (1): the owner cannot see their own just-inserted note';
  end if;

  raise notice 'RESEARCH EVIDENCE SECURITY TEST (1) PASSED: owner can see their own note';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A different authenticated user, not a workspace member, cannot see
--    the owner's note — even knowing its exact id, and even via the
--    document_id-scoped query shape retrieveNoteContext could plausibly
--    use for a document-restricted research investigation.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_note_id uuid;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  set local role authenticated;
  insert into public.notes (user_id, title, content)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Private research note', 'Confidential findings that must never become another user''s research evidence.')
    returning id into v_note_id;

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  set local role authenticated;

  select count(*) into v_count from public.notes where id = v_note_id;
  if v_count <> 0 then
    raise exception 'RESEARCH EVIDENCE SECURITY TEST FAILED (2a): a non-member could select another user''s note by its exact id';
  end if;

  select count(*) into v_count from public.notes where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';
  if v_count <> 0 then
    raise exception 'RESEARCH EVIDENCE SECURITY TEST FAILED (2b): a non-member could enumerate another user''s notes at all — this is the exact query shape a compromised research evidence path would need to leak private notes';
  end if;

  raise notice 'RESEARCH EVIDENCE SECURITY TEST (2) PASSED: a non-member cannot see or enumerate another user''s notes';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A workspace member with 'viewer' role CAN see a workspace-shared
--    note (the positive case — a legitimate collaborator's research
--    investigation must still find it as evidence), but cannot update
--    or delete it.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_id uuid;
  v_note_id uuid;
  v_count integer;
  v_updated integer;
  v_deleted integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  set local role authenticated;
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Shared Research Workspace')
    returning id into v_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace_id, '249c4f9a-fe94-4174-af49-ca38d526caba', 'viewer', 'active');

  insert into public.notes (user_id, workspace_id, title, content)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_workspace_id, 'Shared research note', 'Findings shared with the workspace.')
    returning id into v_note_id;

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  set local role authenticated;

  select count(*) into v_count from public.notes where id = v_note_id;
  if v_count <> 1 then
    raise exception 'RESEARCH EVIDENCE SECURITY TEST FAILED (3a): a workspace viewer could not see a note shared into their workspace — a legitimate collaborator''s research investigation would silently lose this evidence';
  end if;

  update public.notes set title = 'Hacked by viewer' where id = v_note_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'RESEARCH EVIDENCE SECURITY TEST FAILED (3b): a read-only workspace viewer was able to update a shared note';
  end if;

  delete from public.notes where id = v_note_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'RESEARCH EVIDENCE SECURITY TEST FAILED (3c): a read-only workspace viewer was able to delete a shared note';
  end if;

  raise notice 'RESEARCH EVIDENCE SECURITY TEST (3) PASSED: a workspace viewer can read a shared note (so it remains available as research evidence) but cannot update or delete it';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. A non-member cannot insert a note claiming to be owned by another
--    user (with-check denial — provenance cannot be spoofed by client
--    input, so a research evidence item's `source.id` can never be
--    forged to point at a note the caller doesn't actually own).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_failed boolean := false;
begin
  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  set local role authenticated;

  begin
    insert into public.notes (user_id, title, content)
      values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Spoofed note', 'Impersonating another user''s ownership.');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'RESEARCH EVIDENCE SECURITY TEST FAILED (4): a user inserted a note impersonating another user''s ownership';
  end if;

  raise notice 'RESEARCH EVIDENCE SECURITY TEST (4) PASSED: with-check blocks inserting a note under another user''s identity';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Unauthenticated (anon) access sees no notes at all.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_note_id uuid;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  set local role authenticated;
  insert into public.notes (user_id, title, content)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Research note', 'Some findings.')
    returning id into v_note_id;

  set local "request.jwt.claims" = '{"role":"anon"}';
  set local role anon;

  select count(*) into v_count from public.notes where id = v_note_id;
  if v_count <> 0 then
    raise exception 'RESEARCH EVIDENCE SECURITY TEST FAILED (5): unauthenticated (anon) access could see a note';
  end if;

  reset role;
  raise notice 'RESEARCH EVIDENCE SECURITY TEST (5) PASSED: unauthenticated access sees no notes';
end;
$$;

rollback;
