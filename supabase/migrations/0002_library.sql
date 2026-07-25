-- Milestone 2: knowledge library and document management.

create type document_file_type as enum ('pdf', 'epub', 'docx', 'txt', 'markdown');
create type document_status as enum ('uploaded', 'processing', 'ready', 'error');

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.collections (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete set null,
  title text not null,
  file_name text not null,
  file_path text not null unique,
  file_type document_file_type not null,
  file_size bigint not null,
  status document_status not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.document_tags (
  document_id uuid not null references public.documents (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (document_id, tag_id)
);

create index documents_user_id_idx on public.documents (user_id);
create index documents_collection_id_idx on public.documents (collection_id);
create index collections_user_id_idx on public.collections (user_id);
create index collections_parent_id_idx on public.collections (parent_id);
create index document_tags_tag_id_idx on public.document_tags (tag_id);

create trigger set_collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

create trigger set_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.collections enable row level security;
alter table public.documents enable row level security;
alter table public.tags enable row level security;
alter table public.document_tags enable row level security;

create policy "Users manage their own collections"
  on public.collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own documents"
  on public.documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own tags"
  on public.tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage tags on their own documents"
  on public.document_tags for all
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_tags.document_id
        and documents.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents
      where documents.id = document_tags.document_id
        and documents.user_id = auth.uid()
    )
  );

-- Storage: one private bucket, objects namespaced by `${user_id}/...`.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Users manage their own files in the documents bucket"
  on storage.objects for all
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
