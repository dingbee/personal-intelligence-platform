-- ARRIYIA Professional Intelligence — Data Intelligence Foundation.
--
-- The architecture audit (docs/intelligence-architecture-reconciliation-
-- audit.md, §8-9) found that a spreadsheet's complete row/column dataset
-- does not survive past upload: it forks into lossy RAG text chunks and
-- a fixed battery of upload-time summary statistics, and the raw parsed
-- grid is discarded. This migration adds the one new table required to
-- close that gap: a durable, queryable representation of the full
-- dataset, persisted once at processing time alongside the existing
-- extraction_metadata write.
--
-- Deliberately NOT a per-cell relational table — that would be schema
-- explosion for no benefit here, since every read is "give me this
-- dataset's full grid" (deterministic execution happens in application
-- code against the fetched rows, exactly like the existing
-- aggregates.ts/columnAnalysis.ts modules already compute over an
-- in-memory grid). jsonb is the smallest reliable representation that
-- still allows deterministic querying once fetched.
--
-- Does not duplicate the original binary file (still in Supabase
-- Storage, untouched) — this table references the existing `documents`
-- row by id rather than re-storing file bytes.
--
-- One row per (document, sheet) — a workbook with N sheets gets N rows.
-- Same ownership/workspace shape as `documents` itself (0002_library.sql):
-- owner-only RLS, nullable workspace_id inherited from the source
-- document at write time. No new entitlement mechanism — this table has
-- no gating of its own; the Pro-only *capability* that reads it (Data
-- Intelligence's analytical-query capability) is gated the same way
-- every other AI capability is, via requiredFeature/has_feature.

create table public.structured_datasets (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  sheet_index int not null,
  sheet_name text not null,
  -- ColumnAnalysis[] (name, columnIndex, dataType, meaning, hasFormulas,
  -- distinctCount, nonEmptyCount) — the same shape already computed by
  -- analyzeSheet() and persisted (as SheetAnalysis) into
  -- extraction_metadata.metadata.spreadsheet; reused verbatim here, not
  -- redefined.
  columns jsonb not null,
  -- CellValue[][] (string | number | boolean | null), one array per data
  -- row (header excluded), same column order as `columns`.
  rows jsonb not null,
  row_count int not null,
  column_count int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint structured_datasets_document_sheet_key unique (document_id, sheet_index)
);

create index structured_datasets_document_id_idx on public.structured_datasets (document_id);
create index structured_datasets_user_id_idx on public.structured_datasets (user_id);
create index structured_datasets_workspace_id_idx on public.structured_datasets (workspace_id);

create trigger set_structured_datasets_updated_at
  before update on public.structured_datasets
  for each row execute function public.set_updated_at();

alter table public.structured_datasets enable row level security;

-- Same shape as "Users manage their own documents" (0002_library.sql) —
-- owner-only, no workspace-member sharing, consistent with documents
-- themselves not being workspace-shared today either.
create policy "Users manage their own structured datasets"
  on public.structured_datasets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
