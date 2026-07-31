-- UX-13.8.2: Asset/Image Foundation — the boring-but-essential layer
-- (upload, validate, compress, generate derivatives, store metadata,
-- serve optimized versions) underneath future OCR/embedding/knowledge-graph/
-- vision-agent work, none of which is in scope here. Deliberately its own
-- table rather than a documents row — images aren't "extract text and
-- chat with" content the way PDFs/EPUBs are (at least not yet), and the
-- three-path shape (original/optimized/thumbnail) has no equivalent in
-- documents.

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  original_path text not null,
  optimized_path text not null,
  thumbnail_path text not null,
  mime_type text not null,
  width integer not null,
  height integer not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index assets_owner_id_idx on public.assets (owner_id);
create index assets_workspace_id_idx on public.assets (workspace_id);

alter table public.assets enable row level security;

create policy "Users manage their own assets"
  on public.assets for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Storage: one private bucket, objects namespaced by `${user_id}/...`,
-- same convention as the documents bucket (0002_library.sql). Private
-- (not a public bucket) for the same reason documents is private —
-- serving "optimized versions" happens via signed URLs, not public URLs.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

create policy "Users manage their own files in the assets bucket"
  on storage.objects for all
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
