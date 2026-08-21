-- ARRIYIA — Import from Google Drive.
--
-- Reuses the EXISTING document intake pipeline entirely: a Drive import
-- still ends as a plain row in `documents` + an object in the `documents`
-- storage bucket, created the same way uploadDocument() creates one today
-- (src/modules/library/api/documents.ts) — so storage_bytes quota
-- enforcement (enforce_storage_quota(), 0046) applies unchanged, RLS on
-- `documents` applies unchanged, and processing/reading of the resulting
-- document is unchanged. This migration adds exactly two things:
--
--   1. Provenance columns on `documents` (source/source_file_id/
--      source_metadata/imported_at) — nullable/defaulted so every
--      existing row (implicitly 'upload') needs no backfill logic beyond
--      the column default itself.
--   2. `google_drive_connections` — the server-only OAuth refresh-token
--      store. Zero client policies of any kind (matching
--      founding_pro_expiry_notifications' precedent, 0078): a refresh
--      token must never be readable from the client under any
--      circumstance, so this is not even a "user can see their own row"
--      table — the one client-facing fact ("are you connected") is
--      exposed instead through get_google_drive_connection_status(),
--      which returns a boolean and a timestamp, never the token itself.
--      All writes go through the google-drive-oauth edge function using
--      the service-role key (never through PostgREST/RLS), matching
--      pesapal_checkout_orders' own service-role-only write pattern.

-- ---------------------------------------------------------------------
-- 1. documents — provenance columns.
-- ---------------------------------------------------------------------

alter table public.documents
  add column if not exists source text not null default 'upload',
  add column if not exists source_file_id text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists imported_at timestamptz;

alter table public.documents
  add constraint documents_source_check check (source in ('upload', 'google_drive'));

-- Dedup: the same Drive file, imported again by the same user, must not
-- create a second document row — this is the "existing provenance/
-- deduplication mechanism" the product brief asks to prefer over
-- inventing a second one, scoped per-user (not globally) since two
-- different ARRIYIA users importing the same shared Drive file are
-- legitimately separate documents, one per owner.
create unique index if not exists documents_source_file_id_unique
  on public.documents (user_id, source, source_file_id)
  where source_file_id is not null;

-- ---------------------------------------------------------------------
-- 2. google_drive_connections.
-- ---------------------------------------------------------------------

create table public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_drive_connections_user_unique unique (user_id)
);

alter table public.google_drive_connections enable row level security;
-- No policies of any kind — see this migration's own header. RLS with
-- zero policies default-denies every client role (authenticated/anon)
-- outright; only a SECURITY DEFINER function or the service-role key can
-- ever touch this table.

-- ---------------------------------------------------------------------
-- 3. get_google_drive_connection_status() — the one client-readable fact.
--    Self-only (auth.uid()), matches the whole codebase's "own row only"
--    convention exactly, but exposes strictly less than a raw row would.
-- ---------------------------------------------------------------------

create or replace function public.get_google_drive_connection_status()
returns table (connected boolean, connected_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists(select 1 from public.google_drive_connections where user_id = auth.uid()),
    (select gdc.connected_at from public.google_drive_connections gdc where gdc.user_id = auth.uid());
$$;

revoke execute on function public.get_google_drive_connection_status() from public;
revoke execute on function public.get_google_drive_connection_status() from anon;
grant execute on function public.get_google_drive_connection_status() to authenticated;

-- ---------------------------------------------------------------------
-- 4. disconnect_google_drive() — lets a user revoke their own stored
--    connection without needing an edge function round trip (deleting a
--    row is safe to expose directly as a narrow SECURITY DEFINER
--    function; nothing sensitive is ever returned).
-- ---------------------------------------------------------------------

create or replace function public.disconnect_google_drive()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.google_drive_connections where user_id = auth.uid();
end;
$$;

revoke execute on function public.disconnect_google_drive() from public;
revoke execute on function public.disconnect_google_drive() from anon;
grant execute on function public.disconnect_google_drive() to authenticated;
