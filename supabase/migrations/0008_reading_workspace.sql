-- Milestone 6: EPUB reading workspace — persisted reading progress,
-- highlights with optional attached notes (passage-anchored annotations;
-- the full standalone Notes module stays Milestone 7), cached chapter
-- summaries, and flashcards generated from chapter content.

create table public.reading_progress (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_index int not null default 0,
  scroll_fraction float not null default 0,
  updated_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_index int,
  quote text not null,
  -- A highlight with a note attached is a passage-anchored annotation —
  -- lighter-weight than the standalone Notes module (Milestone 7), but
  -- covers "notes linked to a passage" for this milestone's reading workspace.
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapter_summaries (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_index int not null,
  content text not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (document_id, chapter_index)
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_index int,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);

create index highlights_document_id_idx on public.highlights (document_id);
create index flashcards_document_id_idx on public.flashcards (document_id);

create trigger set_highlights_updated_at
  before update on public.highlights
  for each row execute function public.set_updated_at();

create trigger set_reading_progress_updated_at
  before update on public.reading_progress
  for each row execute function public.set_updated_at();

create trigger set_chapter_summaries_updated_at
  before update on public.chapter_summaries
  for each row execute function public.set_updated_at();

alter table public.reading_progress enable row level security;
alter table public.highlights enable row level security;
alter table public.chapter_summaries enable row level security;
alter table public.flashcards enable row level security;

create policy "Users manage their own reading progress"
  on public.reading_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own highlights"
  on public.highlights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own chapter summaries"
  on public.chapter_summaries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own flashcards"
  on public.flashcards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
