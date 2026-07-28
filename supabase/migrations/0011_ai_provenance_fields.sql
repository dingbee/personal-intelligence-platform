-- Knowledge Intelligence Phase 5, Task 3: AI provenance fields.
--
-- Every AI-generated knowledge artifact (chapter summary, flashcard set,
-- and — once notes/highlights gain AI-assist — those too) should be
-- traceable back to the document_chunks it was derived from. Nothing
-- currently records this beyond a coarse chapter_index; messages.context_
-- chunk_ids is the one existing precedent for chunk-level provenance
-- elsewhere in this schema.
--
-- Both columns are nullable with no default, deliberately: NULL means
-- "not AI-generated / provenance not recorded" (true for every existing
-- row, and for user-authored notes/highlights, which are never
-- AI-generated at all), which is a different, correct meaning from an
-- empty array/object. Application code populates them only when content
-- is actually AI-generated.
--
-- No index added: nothing queries by source_chunk_ids or generation_metadata
-- yet (both are for display/traceability on an already-fetched row, not for
-- filtering), and all four tables are near-empty in production. A GIN index
-- on source_chunk_ids would be the right move if a reverse-lookup query
-- ("which generated content cites chunk X") becomes a real need later.

alter table public.chapter_summaries
  add column if not exists source_chunk_ids jsonb,
  add column if not exists generation_metadata jsonb;

alter table public.flashcards
  add column if not exists source_chunk_ids jsonb,
  add column if not exists generation_metadata jsonb;

alter table public.notes
  add column if not exists source_chunk_ids jsonb,
  add column if not exists generation_metadata jsonb;

alter table public.highlights
  add column if not exists source_chunk_ids jsonb,
  add column if not exists generation_metadata jsonb;
