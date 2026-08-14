-- ARRIYIA Professional Intelligence — Data Intelligence Foundation
-- security test. structured_datasets follows the exact same owner-only
-- RLS shape as `documents` (0002_library.sql) — no new authorization
-- primitive, no SECURITY DEFINER function. These tests confirm that
-- shape actually holds for this new table: owner can read/write their
-- own rows, no other authenticated user can read, insert-as, update, or
-- delete another user's row (including by guessing a real dataset id),
-- and unauthenticated (anon) access is denied outright.
--
-- Same conventions as pro_intelligence_foundation_security_test.sql:
-- each numbered block is a self-contained `begin; ... rollback;`
-- transaction, `request.jwt.claims` simulates a real authenticated
-- session (no role switch except test 6's anon check). Users reused
-- from the same vetted, safe-to-mutate-within-a-rollback set:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) — "owner"
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com) — "attacker"

-- ---------------------------------------------------------------------
-- 1. The owner can insert and select their own structured_datasets row.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_document_id uuid;
  v_dataset_id uuid;
begin
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Sales.xlsx', 'sales.xlsx', 'test/owner-sales.xlsx', 'xlsx', 1000, 'ready')
    returning id into v_document_id;

  insert into public.structured_datasets (document_id, user_id, sheet_index, sheet_name, columns, rows, row_count, column_count)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Sheet1', '[]'::jsonb, '[]'::jsonb, 0, 0)
    returning id into v_dataset_id;

  if not exists (select 1 from public.structured_datasets where id = v_dataset_id) then
    raise exception 'STRUCTURED DATASETS TEST FAILED (1): the owner cannot see their own just-inserted row';
  end if;

  raise notice 'STRUCTURED DATASETS TEST (1) PASSED: owner can insert and select their own row';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A different authenticated user cannot select the owner's row, even
--    when they know its exact id (dataset-id-manipulation attempt).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_document_id uuid;
  v_dataset_id uuid;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Sales.xlsx', 'sales.xlsx', 'test/owner-sales-2.xlsx', 'xlsx', 1000, 'ready')
    returning id into v_document_id;
  insert into public.structured_datasets (document_id, user_id, sheet_index, sheet_name, columns, rows, row_count, column_count)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Sheet1', '[]'::jsonb, '[]'::jsonb, 0, 0)
    returning id into v_dataset_id;

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  select count(*) into v_count from public.structured_datasets where id = v_dataset_id;

  if v_count <> 0 then
    raise exception 'STRUCTURED DATASETS TEST FAILED (2): a different authenticated user could select another user''s dataset by its exact id';
  end if;

  raise notice 'STRUCTURED DATASETS TEST (2) PASSED: RLS hides another user''s dataset even when the id is known exactly';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A different authenticated user cannot insert a row claiming to be
--    the owner (with-check denial: inserting user_id = victim while
--    authenticated as the attacker).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_document_id uuid;
  v_failed boolean := false;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Sales.xlsx', 'sales.xlsx', 'test/owner-sales-3.xlsx', 'xlsx', 1000, 'ready')
    returning id into v_document_id;

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  begin
    insert into public.structured_datasets (document_id, user_id, sheet_index, sheet_name, columns, rows, row_count, column_count)
      values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Sheet1', '[]'::jsonb, '[]'::jsonb, 0, 0);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'STRUCTURED DATASETS TEST FAILED (3): a non-owner inserted a row impersonating another user''s ownership';
  end if;

  raise notice 'STRUCTURED DATASETS TEST (3) PASSED: with-check blocks inserting a row under another user''s identity';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. A different authenticated user cannot update or delete the
--    owner's row.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_document_id uuid;
  v_dataset_id uuid;
  v_updated integer;
  v_deleted integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Sales.xlsx', 'sales.xlsx', 'test/owner-sales-4.xlsx', 'xlsx', 1000, 'ready')
    returning id into v_document_id;
  insert into public.structured_datasets (document_id, user_id, sheet_index, sheet_name, columns, rows, row_count, column_count)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Sheet1', '[]'::jsonb, '[]'::jsonb, 0, 0)
    returning id into v_dataset_id;

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

  update public.structured_datasets set sheet_name = 'Hacked' where id = v_dataset_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'STRUCTURED DATASETS TEST FAILED (4a): a non-owner updated another user''s dataset row';
  end if;

  delete from public.structured_datasets where id = v_dataset_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'STRUCTURED DATASETS TEST FAILED (4b): a non-owner deleted another user''s dataset row';
  end if;

  raise notice 'STRUCTURED DATASETS TEST (4) PASSED: a non-owner can neither update nor delete another user''s dataset row';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Unauthenticated (anon) access is denied outright — no row visible,
--    matching every other user-owned table's convention.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_document_id uuid;
  v_dataset_id uuid;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Sales.xlsx', 'sales.xlsx', 'test/owner-sales-5.xlsx', 'xlsx', 1000, 'ready')
    returning id into v_document_id;
  insert into public.structured_datasets (document_id, user_id, sheet_index, sheet_name, columns, rows, row_count, column_count)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Sheet1', '[]'::jsonb, '[]'::jsonb, 0, 0)
    returning id into v_dataset_id;

  set local "request.jwt.claims" = '{"role":"anon"}';
  set local role anon;
  select count(*) into v_count from public.structured_datasets where id = v_dataset_id;
  reset role;

  if v_count <> 0 then
    raise exception 'STRUCTURED DATASETS TEST FAILED (5): an unauthenticated (anon) request could see a structured dataset row';
  end if;

  raise notice 'STRUCTURED DATASETS TEST (5) PASSED: unauthenticated access sees no structured dataset rows';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. Deleting the parent document cascades to its structured datasets
--    (no orphaned rows an attacker could later re-associate).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_document_id uuid;
  v_dataset_id uuid;
begin
  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, status)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Sales.xlsx', 'sales.xlsx', 'test/owner-sales-6.xlsx', 'xlsx', 1000, 'ready')
    returning id into v_document_id;
  insert into public.structured_datasets (document_id, user_id, sheet_index, sheet_name, columns, rows, row_count, column_count)
    values (v_document_id, '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 0, 'Sheet1', '[]'::jsonb, '[]'::jsonb, 0, 0)
    returning id into v_dataset_id;

  delete from public.documents where id = v_document_id;

  if exists (select 1 from public.structured_datasets where id = v_dataset_id) then
    raise exception 'STRUCTURED DATASETS TEST FAILED (6): deleting the parent document left an orphaned structured dataset row';
  end if;

  raise notice 'STRUCTURED DATASETS TEST (6) PASSED: deleting the parent document cascades to its structured datasets';
end;
$$;

rollback;
