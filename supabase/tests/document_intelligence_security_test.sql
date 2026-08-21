-- ARRIYIA — I3 Document Intelligence security test.
--
-- `documents`/`document_chunks`/`embeddings` RLS was verified by reading
-- the live policy SQL directly (owner-or-workspace-role OR-clause,
-- `has_workspace_role`, 0028_workspace_members.sql /
-- 0031_shared_knowledge_objects.sql) but — unlike most other
-- entitlement/security-sensitive tables in this codebase — had no
-- checked-in, runnable regression test of its own. This file adds one,
-- following the exact same rollback-wrapped-transaction convention
-- structured_datasets_security_test.sql already established: each
-- numbered block is a self-contained `begin; ... rollback;` transaction,
-- `request.jwt.claims` simulates a real authenticated session. Every
-- simulated session also does `set local role authenticated` (or `anon`)
-- explicitly, not just the claims GUC — this connection (like several
-- MCP/admin tooling connections) is itself `postgres`, which has
-- `rolbypassrls = true` and so evaluates RLS policies at all only when
-- the *role* is actually switched to one that doesn't bypass it; setting
-- only `request.jwt.claims` without the role switch would make a
-- cross-user denial assertion vacuously pass here regardless of whether
-- the real policy denies anything, which is exactly the false-negative
-- this file's own first draft caught (test 2 below "failed" until the
-- role switch was added — see the file's commit history). Users reused
-- from the same vetted, safe-to-mutate-within-a-rollback set already
-- used by every other security test in this directory:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) — "owner"
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com) — "outsider" / "viewer"
--
-- A small local zero vector stands in for `embeddings.embedding`
-- (vector(1536)) — its actual values are irrelevant to every test below,
-- only its presence/visibility under RLS is.

-- ---------------------------------------------------------------------
-- 1. The owner can select their own document, its chunks, and its
--    chunks' embeddings.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_document_id uuid;
  v_chunk_id uuid;
  v_zero_vector vector(1536) := ('[' || array_to_string(array_fill(0::float, array[1536]), ',') || ']')::vector;
begin
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Report.pdf', 'report.pdf', 'test/owner-report-1.pdf', 'pdf', 1000, 'ready')
    returning id into v_document_id;
  insert into public.document_chunks (document_id, user_id, chunk_index, content, char_start, char_end, token_count, chapter_index, chapter_title)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Chunk content.', 0, 15, 4, 0, 'Page 1')
    returning id into v_chunk_id;
  insert into public.embeddings (chunk_id, model, embedding) values (v_chunk_id, 'text-embedding-3-small', v_zero_vector);

  if not exists (select 1 from public.documents where id = v_document_id) then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (1a): the owner cannot see their own just-inserted document';
  end if;
  if not exists (select 1 from public.document_chunks where id = v_chunk_id) then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (1b): the owner cannot see their own just-inserted chunk';
  end if;
  if not exists (select 1 from public.embeddings where chunk_id = v_chunk_id) then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (1c): the owner cannot see their own chunk''s embedding';
  end if;

  raise notice 'DOCUMENT INTELLIGENCE TEST (1) PASSED: owner can see their own document, chunk, and embedding';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A different authenticated user, not a workspace member, cannot see
--    the owner's document, chunks, or embeddings — even knowing the
--    exact ids (id-guessing / IDOR attempt) — and cannot retrieve it via
--    document-scoped grounded Q&A's own query shape.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_document_id uuid;
  v_chunk_id uuid;
  v_zero_vector vector(1536) := ('[' || array_to_string(array_fill(0::float, array[1536]), ',') || ']')::vector;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  set local role authenticated;
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Report.pdf', 'report.pdf', 'test/owner-report-2.pdf', 'pdf', 1000, 'ready')
    returning id into v_document_id;
  insert into public.document_chunks (document_id, user_id, chunk_index, content, char_start, char_end, token_count, chapter_index, chapter_title)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Confidential chunk content.', 0, 28, 6, 0, 'Page 1')
    returning id into v_chunk_id;
  insert into public.embeddings (chunk_id, model, embedding) values (v_chunk_id, 'text-embedding-3-small', v_zero_vector);

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  set local role authenticated;

  select count(*) into v_count from public.documents where id = v_document_id;
  if v_count <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (2a): a non-member could select another user''s document by its exact id';
  end if;

  select count(*) into v_count from public.document_chunks where id = v_chunk_id;
  if v_count <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (2b): a non-member could select another user''s document chunk by its exact id';
  end if;

  select count(*) into v_count from public.document_chunks where document_id = v_document_id;
  if v_count <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (2c): a non-member could enumerate another user''s document chunks by document_id (the exact query shape grounded Q&A/retrieval uses)';
  end if;

  select count(*) into v_count from public.embeddings where chunk_id = v_chunk_id;
  if v_count <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (2d): a non-member could select another user''s chunk embedding';
  end if;

  raise notice 'DOCUMENT INTELLIGENCE TEST (2) PASSED: a non-member cannot see another user''s document, chunks (by id or by document_id), or embeddings';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A workspace member with 'viewer' role CAN see a workspace-shared
--    document and its chunks (the positive sharing case — confirms RLS
--    isn't over-broadly denying legitimate collaboration), but cannot
--    update or delete it (viewer is read-only; editor+ is required to
--    write, per has_workspace_role's own role ordering).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_id uuid;
  v_document_id uuid;
  v_chunk_id uuid;
  v_count integer;
  v_updated integer;
  v_deleted integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  set local role authenticated;
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Shared Workspace')
    returning id into v_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace_id, '249c4f9a-fe94-4174-af49-ca38d526caba', 'viewer', 'active');

  insert into public.documents (user_id, workspace_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_workspace_id, 'Shared Report.pdf', 'report.pdf', 'test/owner-report-3.pdf', 'pdf', 1000, 'ready')
    returning id into v_document_id;
  insert into public.document_chunks (document_id, user_id, workspace_id, chunk_index, content, char_start, char_end, token_count, chapter_index, chapter_title)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_workspace_id, 0, 'Shared chunk content.', 0, 21, 4, 0, 'Page 1')
    returning id into v_chunk_id;

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  set local role authenticated;

  select count(*) into v_count from public.documents where id = v_document_id;
  if v_count <> 1 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (3a): a workspace viewer could not see a document shared into their workspace';
  end if;

  select count(*) into v_count from public.document_chunks where document_id = v_document_id;
  if v_count <> 1 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (3b): a workspace viewer could not see a shared document''s chunks (retrieval would silently fail for a legitimate collaborator)';
  end if;

  update public.documents set title = 'Hacked by viewer' where id = v_document_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (3c): a read-only workspace viewer was able to update a shared document';
  end if;

  delete from public.documents where id = v_document_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (3d): a read-only workspace viewer was able to delete a shared document';
  end if;

  raise notice 'DOCUMENT INTELLIGENCE TEST (3) PASSED: a workspace viewer can read a shared document and its chunks, but cannot update or delete it';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. A non-member cannot insert a document or chunk claiming to be
--    owned by another user (with-check denial — provenance cannot be
--    spoofed by client input).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_document_id uuid;
  v_failed boolean := false;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  set local role authenticated;
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Report.pdf', 'report.pdf', 'test/owner-report-4.pdf', 'pdf', 1000, 'ready')
    returning id into v_document_id;

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  set local role authenticated;

  begin
    insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
      values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Spoofed.pdf', 'spoofed.pdf', 'test/spoofed.pdf', 'pdf', 1000, 'ready');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (4a): a user inserted a document impersonating another user''s ownership';
  end if;

  v_failed := false;
  begin
    insert into public.document_chunks (document_id, user_id, chunk_index, content, char_start, char_end, token_count)
      values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 99, 'Spoofed chunk claiming another user''s ownership.', 0, 49, 9);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (4b): a non-member inserted a chunk under another user''s document/ownership';
  end if;

  raise notice 'DOCUMENT INTELLIGENCE TEST (4) PASSED: with-check blocks inserting a document or chunk under another user''s identity';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Unauthenticated (anon) access sees no documents, chunks, or
--    embeddings — matching every other user-owned table's convention.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_document_id uuid;
  v_chunk_id uuid;
  v_zero_vector vector(1536) := ('[' || array_to_string(array_fill(0::float, array[1536]), ',') || ']')::vector;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  set local role authenticated;
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Report.pdf', 'report.pdf', 'test/owner-report-5.pdf', 'pdf', 1000, 'ready')
    returning id into v_document_id;
  insert into public.document_chunks (document_id, user_id, chunk_index, content, char_start, char_end, token_count, chapter_index, chapter_title)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Chunk content.', 0, 15, 4, 0, 'Page 1')
    returning id into v_chunk_id;
  insert into public.embeddings (chunk_id, model, embedding) values (v_chunk_id, 'text-embedding-3-small', v_zero_vector);

  set local "request.jwt.claims" = '{"role":"anon"}';
  set local role anon;

  select count(*) into v_count from public.documents where id = v_document_id;
  if v_count <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (5a): unauthenticated (anon) access could see a document';
  end if;

  select count(*) into v_count from public.document_chunks where id = v_chunk_id;
  if v_count <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (5b): unauthenticated (anon) access could see a document chunk';
  end if;

  select count(*) into v_count from public.embeddings where chunk_id = v_chunk_id;
  if v_count <> 0 then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (5c): unauthenticated (anon) access could see an embedding';
  end if;

  reset role;
  raise notice 'DOCUMENT INTELLIGENCE TEST (5) PASSED: unauthenticated access sees no documents, chunks, or embeddings';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. Deleting the parent document cascades to its chunks and embeddings
--    (no orphaned rows an attacker could later re-associate).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_document_id uuid;
  v_chunk_id uuid;
  v_zero_vector vector(1536) := ('[' || array_to_string(array_fill(0::float, array[1536]), ',') || ']')::vector;
begin
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Report.pdf', 'report.pdf', 'test/owner-report-6.pdf', 'pdf', 1000, 'ready')
    returning id into v_document_id;
  insert into public.document_chunks (document_id, user_id, chunk_index, content, char_start, char_end, token_count, chapter_index, chapter_title)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Chunk content.', 0, 15, 4, 0, 'Page 1')
    returning id into v_chunk_id;
  insert into public.embeddings (chunk_id, model, embedding) values (v_chunk_id, 'text-embedding-3-small', v_zero_vector);

  delete from public.documents where id = v_document_id;

  if exists (select 1 from public.document_chunks where id = v_chunk_id) then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (6a): deleting the parent document left an orphaned chunk';
  end if;
  if exists (select 1 from public.embeddings where chunk_id = v_chunk_id) then
    raise exception 'DOCUMENT INTELLIGENCE TEST FAILED (6b): deleting the parent document left an orphaned embedding';
  end if;

  raise notice 'DOCUMENT INTELLIGENCE TEST (6) PASSED: deleting the parent document cascades to its chunks and embeddings';
end;
$$;

rollback;
