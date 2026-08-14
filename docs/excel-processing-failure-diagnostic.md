# Excel Processing Failure — Diagnostic Audit

**Repository:** dingbee/personal-intelligence-platform
**Branch:** main
**Baseline commit at time of audit:** `1a267e4` (which contains `a0ed152` Operation Budget Foundation as an ancestor)
**Scope of this document:** diagnostic only — no source, migration, or database changes were made while producing it.

**Production document under investigation:**
- `document_id`: `c4a204ac-a291-4e53-a421-8093918dab40`
- file: `Mtoni_River_Lodge_Dinner_Recipe_Book.xlsx`, `file_type: xlsx`, `file_size: 13644` bytes
- `documents.status = 'error'`
- Spreadsheet Analysis populated: 7 sheets (Overview, Beef, Lamb, Chicken, Pork, Soups, Desserts), 135 rows total
- `document_chunks` count for this document: **0**
- Two `processing_jobs` rows, both `status = 'failed'`, both `error_message = "Processing failed"`:
  - `b96652f7-16b0-4bc7-a779-ec0c2d86e6c9` — 2026-08-14 17:07:01.413+00 → 17:07:04.171+00 (~2.8s)
  - `fa66ce14-3840-4888-93fa-dd1446ce72d3` — 2026-08-14 16:52:19.116+00 → 16:52:22.218+00 (~3.1s)

---

## A. Confirmed facts

1. Upload succeeded (the document row and file exist; extraction ran against it).
2. Extraction succeeded: the spreadsheet extractor (`src/modules/processing/extractors/spreadsheet.ts`) parsed all 7 sheets and 135 rows without throwing — this could only be true if `XLSX.read()` and `analyzeSheet()` both completed cleanly for every sheet.
3. `extraction_metadata` was persisted successfully: the Document Detail page's "Spreadsheet Analysis" panel reads exclusively from `useExtractionMetadata` → `extraction_metadata.metadata.spreadsheet`, populated by `saveExtractionMetadata()`, which runs *before* `saveStructuredDatasets()` in `processDocument.ts`. This panel would render nothing if that write had failed.
4. `document_chunks` has zero rows for this document. Chunk count is read by `useDocumentChunkCount`, a direct `count`-only query against `document_chunks`.
5. Both processing attempts failed in ~3 seconds — consistent with a single fast-failing synchronous/network call, not a multi-batch embedding loop (which would take longer and would only be reached after chunking, i.e., after `document_chunks` had at least some rows).
6. Both failures recorded the **literal string** `"Processing failed"` as `error_message`.
7. A full-repository grep for the exact string `'Processing failed'` (single or double quoted) across `src/**/*.ts(x)` returns **exactly one match**: `src/modules/processing/pipeline/processDocument.ts:133`.
8. That line has existed, unchanged, since the file's original commit (`6819c78`, "Milestone 3: document processing pipeline") — years before Data Intelligence Foundation (`8dbdf44`) or Operation Budget Foundation existed. It was not modified by either of those later commits.
9. `supabase/functions/` contains no server-side document-processing implementation; `processDocument()` is the *only* implementation of this pipeline, confirmed via `processDocument.ts`'s own doc comment ("Runs client-side and fire-and-forget from the UI").

## B. Exact pipeline trace (current code, in order)

```
processDocument(documentId, userId)
  1. createProcessingJob                          → INSERT processing_jobs (status: 'queued')
  2. updateDocumentStatus(documentId, 'processing') → UPDATE documents
  3. updateProcessingJob(job.id, { status: 'extracting' })
  4. getDocument(documentId)                       → SELECT documents
  5. downloadDocumentFile(document.file_path)       → Storage download
  6. getDocumentProcessor(document.file_type)        → dynamic import('.../extractors/spreadsheet')
  7. processor.extract(file)                        → XLSX.read + analyzeSheet (pure, in-memory)
  8. saveExtractionMetadata({...})                  → UPSERT extraction_metadata      ✅ CONFIRMED SUCCEEDED
  9. if (extraction.structuredData.length > 0)
       saveStructuredDatasets({...})                → UPSERT structured_datasets     ⚠️ FAILURE WINDOW
 10. updateProcessingJob(job.id, { status: 'chunking' })                              ❌ NEVER REACHED (chunks=0)
 11. chunker.chunk(...)                             → pure, in-memory
 12. replaceDocumentChunks({...})                   → DELETE + INSERT document_chunks
 13. updateProcessingJob(job.id, { status: 'embedding' })
 14. embedBatchWithRetry × batches                  → ai-chat edge fn + vector upsert
 15. updateProcessingJob(job.id, { status: 'completed', ... })
 16. updateDocumentStatus(documentId, 'ready')

catch (err):
    message = err instanceof Error ? err.message : 'Processing failed'   ← line 133
    updateProcessingJob(job.id, { status: 'failed', error_message: message, ... }).catch(() => undefined)
    updateDocumentStatus(documentId, 'error').catch(() => undefined)
```

Steps 1–8 are confirmed to have executed (job exists, `extraction_metadata` populated). Step 10 is confirmed **not** to have executed (chunks = 0, and step 10 unconditionally precedes any chunk write — if it ran, `replaceDocumentChunks` would have at minimum attempted a write). This constrains the failure to **step 9, `saveStructuredDatasets()`**, as the only code that executes between the confirmed-success point and the confirmed-not-reached point. No other code sits in that window.

## C. Exact exception-swallowing location

`src/modules/processing/pipeline/processDocument.ts:133`:

```ts
const message = err instanceof Error ? err.message : 'Processing failed'
```

This is the **only** place in the entire pipeline (and the only place in the whole `src/` tree) that can produce the literal string `"Processing failed"`. It is reached only when the caught value `err` fails the `instanceof Error` check — i.e., whatever was thrown is **not recognized as an `Error` instance** at the point of the `catch`.

This is the central, load-bearing finding of this audit: **production is not failing to log the error — it is failing to recognize the thrown value as an `Error` at all**, so the branch that would preserve `err.message` (which normally *does* carry the real Postgres/PostgREST text) is never taken.

## D/E. Plausible failure classes, with evidence for/against each

| # | Failure class | Evidence for | Evidence against | Verdict |
|---|---|---|---|---|
| 1 | `structured_datasets` table missing in production (migration 0057 never applied) | No CI/automated migration pipeline exists in this repo (`.github/` has no workflows); every Supabase MCP live-verification attempt across this entire session history — including three fresh attempts made specifically during this and the prior two investigation turns — has returned `-32003` (requires human approval), meaning migrations can only reach production via an explicit approved action with no evidence one ever happened for 0057–0061. `saveStructuredDatasets()` is the only genuinely new persistence call introduced by Data Intelligence Foundation. | If this were the cause, the thrown value would be a `PostgrestError` (`code: '42P01'`), and **`PostgrestError extends Error`** in the pinned `@supabase/postgrest-js@2.110.8` (confirmed by reading `node_modules/@supabase/postgrest-js/dist/index.d.mts`: `declare class PostgrestError extends Error`). `err instanceof Error` would be **true**, so `err.message` (the real "relation does not exist" text) would have been captured instead of the generic fallback. This directly contradicts observation #7/#8. | **LIKELY still the underlying DB-level problem, but CANNOT be the reason the message reads "Processing failed"** — those are two separate questions (see §G). |
| 2 | RLS denial on `structured_datasets` insert (`23...`/`42501`) | Same reasoning as #1 — `saveStructuredDatasets` is the only candidate in the failure window. | Same objection as #1: a PostgREST RLS denial is also delivered as a `PostgrestError`, which extends `Error`. Would not produce the generic fallback message either. | **UNKNOWN as DB cause; ruled out as the reason for message swallowing** by the same logic. |
| 3 | JSONB payload issue (oversized `rows`, invalid UTF-8/NUL byte, non-serializable value) | The workbook has 135 rows across 7 sheets — not large by JSONB standards (~13KB source file), but a NUL character (` `) embedded in a text cell is a well-known, common real-world Excel/CSV artifact (e.g., pasted from legacy systems) that Postgres `text`/`jsonb` columns reject outright with `22P02 invalid input syntax` — this is a genuine, unruled-out possibility for a *recipe book* workbook that may contain pasted/imported content. | If PostgREST rejects the payload, the error again arrives as a `PostgrestError` (still `instanceof Error`). If instead `JSON.stringify` itself throws client-side (e.g. on a circular reference or `BigInt`) that would be a native `TypeError`, which **also** extends `Error`. Neither naturally explains the fallback being hit. | **UNKNOWN as DB-level cause; does not by itself explain the swallowing.** |
| 4 | Foreign-key violation (`document_id`/`user_id`/`workspace_id`) | None found — `document_id` is guaranteed to exist (extraction already succeeded against the same row), `user_id` is the authenticated caller, `workspace_id` is nullable and sourced directly from the already-fetched `document.workspace_id`. | No plausible path for a dangling reference here. | **Against — no supporting evidence.** |
| 5 | Duplicate/unique constraint (`document_id, sheet_index`) | The `.upsert(..., { onConflict: 'document_id,sheet_index' })` call is specifically designed to make re-processing idempotent; a genuine constraint violation here would indicate the `onConflict` target doesn't match the actual constraint name/columns. | Migration 0057's constraint is `unique (document_id, sheet_index)`, matching the `onConflict` string exactly (Supabase's PostgREST `Prefer: resolution=merge-duplicates` matches by column list, not by constraint name). This is a two-attempt failure (both attempts show `error_message: "Processing failed"`), and if the first attempt had left rows and the second hit a genuine unique-constraint issue with a mismatched `onConflict`, we would expect a `PostgrestError` — again `instanceof Error`. | **Against as primary cause; does not explain swallowing either way.** |
| 6 | **A non-`Error` value is genuinely thrown somewhere in this stack** (raw string/object throw, or a `DOMException` from an aborted fetch, or a cross-module-boundary `instanceof` mismatch) | This is the only class of explanation actually consistent with **all** confirmed facts: extraction succeeded (rules out SheetJS/XLSX throwing inside `extract()`, since that never reached persistence), `extraction_metadata` succeeded, `saveStructuredDatasets` is the sole remaining candidate, and every *typed* Supabase SDK error (`PostgrestError`, `StorageError`, `FunctionsError` family) verifiably extends `Error` in the pinned SDK version — so a normal DB error from that call would **not** hit the fallback. Something about *how* the error surfaces from that call (or from code very close to it) is losing its `Error`-ness before reaching the `catch` in `processDocument.ts`. | No direct log evidence yet — this is inferred from process of elimination on the confirmed facts, not observed directly. `getDocumentProcessor()`'s dynamic `import()` (used to lazy-load the spreadsheet extractor) is a known category of environment where bundler code-splitting can, in some configurations, cause a dependency (potentially including a copy of `@supabase/postgrest-js` if it were duplicated across chunks) to be instantiated from two different module realities, breaking `instanceof` checks against classes from the "other" copy — but this repository's `getDocumentProcessor` only dynamically imports the *extractor* module, not the Supabase client itself (`supabase` is a shared singleton imported statically everywhere, including in `structuredDatasets.ts`), which argues against a chunk-duplication explanation specifically for this call site. | **MOST CONSISTENT WITH ALL EVIDENCE, but root technical mechanism is UNKNOWN** — needs the actual runtime value, not further inference. |

## F. Most probable root cause

- **CONFIRMED:** The failure occurs inside (or immediately around) `saveStructuredDatasets()` — the only code between the last confirmed-successful write (`extraction_metadata`) and the first confirmed-unreached step (chunking/`document_chunks`).
- **CONFIRMED:** The generic `"Processing failed"` text is produced exclusively by the `err instanceof Error` fallback branch at `processDocument.ts:133`, meaning whatever was thrown was not recognized as an `Error` at the catch site.
- **LIKELY (not confirmed):** The underlying database-level cause is a genuine failure on the `structured_datasets` insert/upsert — most plausibly either the table/migration not yet applied in production (`42P01`), or a data-shape issue specific to this workbook (e.g. an embedded NUL character or another JSONB-incompatible value in one of the 135 rows). Both remain live candidates *for the database-level cause*; neither is confirmed.
- **UNKNOWN:** *Why* the thrown value fails `instanceof Error` at all, given that every typed Supabase SDK error class in the pinned dependency versions extends `Error`. This is the piece that, once resolved, will most likely also reveal the database-level cause for free (because a properly-preserved error message would show it directly).
- **UNKNOWN:** Whether migrations 0057–0061 have been applied to the live production database. Supabase MCP live verification was attempted three times across this and the two prior investigation sessions (fresh attempts each time, no blind retrying) and returned `-32003 requires approval` every time. **LIVE SCHEMA STATUS: UNKNOWN.**

## G. Minimal corrective action required (not yet implemented)

Two independent items, in priority order:

1. **Fix the error-classification gap in `processDocument.ts`'s catch handler** (§C). The current `err instanceof Error` check is too narrow to reliably capture Supabase/PostgREST errors, non-`Error` throwables, or any future non-standard rejection value. The minimal, correct fix is to broaden the message-extraction logic to also read a `message` property off any thrown value that has one (not just `Error` instances) before falling back to the generic string — e.g. something equivalent to `typeof (err as any)?.message === 'string' ? (err as any).message : 'Processing failed'`, or a small shared `describeError(err)` helper. This is a pure observability fix: it changes what gets *recorded*, never what gets *attempted* — no behavior change to the pipeline itself, no schema/RLS/migration involvement. **This directly satisfies "if the problem is payload serialization/observability → fix serialization/observability minimally," per the task's own decision tree**, and is the fastest way to convert every future failure (this one included, on reprocess) into a self-diagnosing one.
2. **Determine live migration/schema state for `structured_datasets`.** This requires either (a) Supabase MCP access being explicitly approved by a human for this project, or (b) someone with dashboard/SQL-editor access running a direct check (e.g. `select to_regclass('public.structured_datasets');` and, if it exists, comparing `information_schema.columns` against migration 0057's column list). Only after that is known should any migration-application or RLS-correction action be taken — and only against the confirmed correct production project, never blindly.

No code, migration, or database change has been made in this session in service of either item — this document is diagnostic only, per explicit instruction.

## H. Observability recommendation

- Ship the broadened `describeError`-style catch-handler fix from §G.1. It is low-risk (single function, no I/O change), makes every future processing failure (Excel or otherwise) self-diagnosing without needing repository access to explain, and does not require knowing today's root cause to be worth doing.
- Separately (already committed in a prior session, `1a267e4`, currently on `main`): `ProcessingStatusBadge.tsx` now surfaces `job.error_message` inline instead of only via hover tooltip. Once §G.1 lands, reprocessing this document will surface real, readable text (e.g. an actual Postgres error) directly in the Library grid.
- Consider (not implemented, backlog-only): log the full error object (not just `.message`) to `console.error`, which the code already does at line 134 — confirm this reaches an accessible log sink in production (browser console only, since this runs client-side; there is no server-side log for this specific failure today, which is an inherent limitation of the "fire-and-forget from the UI" architecture documented in `processDocument.ts`'s own comment).

## I. Verification plan after the fix

Once §G.1 (catch-handler fix) is implemented in a future turn:
1. Re-run this exact production document's "Retry processing" action.
2. If `saveStructuredDatasets()` is still the failure point, `processing_jobs.error_message` should now contain the real Postgres error text (class code + message), not "Processing failed" — read it directly.
3. Add a focused regression test only once that real error class is known (e.g., a test asserting the catch handler preserves `.message` from a plain `{message: string}` object, or from a `PostgrestError`-shaped mock, matching whatever the real failure turns out to be).
4. Re-run: `tsc -b`, targeted `processDocument.test.ts`, full `npx vitest run`, `npx oxlint`, `npm run build`.
5. If the root cause turns out to be the missing/misapplied migration, apply 0057–0061 in order (they are additive, already reviewed for dependencies during the prior Operation Budget Foundation sprint, and carry no destructive operations) against the confirmed correct Supabase project only, then re-verify with the same document.
6. Success criterion (per the task brief): this exact document reprocesses to `status: ready` with `chunks > 0`, 7 sheets / 135 rows preserved, and no regression to non-Excel document processing (PDF/EPUB/DOCX/TXT/MD test suites unaffected).

## J. Supabase live-verification limitation

**BLOCKED.** `mcp__Supabase__list_projects` was attempted once during this audit (a fresh, task-specific attempt, not a retry of a stale result) and returned `MCP error -32003: MCP tool call requires approval`. This is consistent with every prior attempt across this session's full history (Operation Budget Foundation sprint, and both prior Excel-failure investigation turns). Per instructions, this was not retried further. **All findings in this document are derived from static code/dependency-version analysis and the production evidence supplied in the task prompt — no live database query, log, or schema inspection was possible.**
