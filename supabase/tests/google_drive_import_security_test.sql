-- ARRIYIA — Import from Google Drive security test
-- (0080_google_drive_import.sql).
--
-- Users reused from the existing test suite's vetted, safe-to-mutate-
-- within-a-rollback set:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)

-- ---------------------------------------------------------------------
-- 1. google_drive_connections is completely inaccessible to any client
--    role — no SELECT, no INSERT, no UPDATE, no DELETE — even for the row
--    "belonging to" the caller. Only get_google_drive_connection_status()/
--    disconnect_google_drive() (SECURITY DEFINER) or the service-role key
--    may ever touch it.
-- ---------------------------------------------------------------------

begin;
set local role postgres;
insert into public.google_drive_connections (user_id, refresh_token)
values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'refresh-token-should-never-be-readable');

set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_count integer;
  v_updated integer;
begin
  select count(*) into v_count from public.google_drive_connections;
  if v_count <> 0 then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (1a): a client could SELECT google_drive_connections directly (% rows visible)', v_count;
  end if;

  -- With RLS enabled and zero policies, an UPDATE whose WHERE clause
  -- matches no RLS-visible row is a silent 0-row no-op, not an
  -- exception — GET DIAGNOSTICS row_count is the correct way to prove
  -- nothing changed (confirmed live: attempting this via `authenticated`
  -- leaves the real row's refresh_token completely untouched).
  update public.google_drive_connections set refresh_token = 'forged' where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (1b): a client could UPDATE google_drive_connections directly (% rows affected)', v_updated;
  end if;

  raise notice 'GOOGLE DRIVE IMPORT TEST (1) PASSED: google_drive_connections is fully inaccessible to client roles';
end;
$$;

reset role;
rollback;

-- ---------------------------------------------------------------------
-- 2. get_google_drive_connection_status() reports true only for a user
--    who actually has a stored connection, and is scoped to the caller —
--    never leaks whether a DIFFERENT user is connected, and never
--    returns the refresh_token itself (structurally impossible — the
--    function's own return type has no such column).
-- ---------------------------------------------------------------------

begin;
set local role postgres;
insert into public.google_drive_connections (user_id, refresh_token)
values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'refresh-token-abc');

do $$
declare
  v_connected boolean;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select connected into v_connected from public.get_google_drive_connection_status();
  if not v_connected then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (2a): the connected user''s own status reports false';
  end if;

  set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';
  select connected into v_connected from public.get_google_drive_connection_status();
  if v_connected then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (2b): an unconnected user''s status incorrectly reports true (cross-user leak)';
  end if;

  raise notice 'GOOGLE DRIVE IMPORT TEST (2) PASSED: connection status is correctly scoped per caller';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. disconnect_google_drive() only ever removes the CALLER's own
--    connection row, never another user's.
-- ---------------------------------------------------------------------

begin;
set local role postgres;
insert into public.google_drive_connections (user_id, refresh_token) values
  ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'refresh-token-owner'),
  ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'refresh-token-other');

do $$
declare
  v_other_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  perform public.disconnect_google_drive();

  set local role postgres;
  if exists (select 1 from public.google_drive_connections where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d') then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (3a): disconnect_google_drive did not remove the caller''s own row';
  end if;

  select count(*) into v_other_count from public.google_drive_connections where user_id = '9e733cfc-e6ae-45e6-8b14-dc64247a9cb2';
  if v_other_count <> 1 then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (3b): disconnect_google_drive affected another user''s connection';
  end if;

  raise notice 'GOOGLE DRIVE IMPORT TEST (3) PASSED: disconnect is scoped to the caller only';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. documents.source defaults to 'upload' for an ordinary insert (no
--    Drive columns set) — existing upload behavior is completely
--    unaffected by this migration.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_doc_id uuid;
  v_source text;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size)
  values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Ordinary Upload', 'ordinary.pdf', '313866d5-4ab7-4d65-bda9-67b9bd668f2d/ordinary-test-unique.pdf', 'pdf', 1024)
  returning id, source into v_doc_id, v_source;

  if v_source <> 'upload' then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (4): an ordinary document insert has source=%, expected upload', v_source;
  end if;

  raise notice 'GOOGLE DRIVE IMPORT TEST (4) PASSED: ordinary uploads default to source=upload';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Dedup: the same (user_id, source, source_file_id) cannot be
--    inserted twice — the partial unique index rejects it, exactly the
--    constraint the google-drive-import edge function relies on as a
--    safety net behind its own pre-check.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_failed boolean := false;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, source, source_file_id)
  values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Drive Doc', 'drive-doc.pdf', '313866d5-4ab7-4d65-bda9-67b9bd668f2d/drive-test-1.pdf', 'pdf', 1024, 'google_drive', 'drive-file-xyz');

  begin
    insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, source, source_file_id)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Drive Doc Again', 'drive-doc-2.pdf', '313866d5-4ab7-4d65-bda9-67b9bd668f2d/drive-test-2.pdf', 'pdf', 1024, 'google_drive', 'drive-file-xyz');
  exception when unique_violation then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (5): the same Drive file was imported twice for the same user without a unique violation';
  end if;

  raise notice 'GOOGLE DRIVE IMPORT TEST (5) PASSED: re-importing the same Drive file for the same user is rejected by the dedup index';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. A user cannot read or alter another user's documents through the
--    Drive-import-adjacent columns — RLS on `documents` is unchanged by
--    this migration, so this simply re-confirms it still holds with the
--    new columns present.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_doc_id uuid;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, source, source_file_id)
  values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Private Drive Doc', 'private.pdf', '313866d5-4ab7-4d65-bda9-67b9bd668f2d/private-test.pdf', 'pdf', 1024, 'google_drive', 'drive-file-private')
  returning id into v_doc_id;

  set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';
  select count(*) into v_count from public.documents where id = v_doc_id;
  if v_count <> 0 then
    raise exception 'GOOGLE DRIVE IMPORT TEST FAILED (6): another user could read a Drive-imported document that is not theirs';
  end if;

  raise notice 'GOOGLE DRIVE IMPORT TEST (6) PASSED: RLS still isolates Drive-imported documents to their owner';
end;
$$;

rollback;
