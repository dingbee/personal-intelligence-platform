# Spreadsheet Intelligence v1 (PIP Sprint 3/10)

See `spreadsheet-intelligence-v1-discovery.md` for the full audit this implementation is based on. Summary: the existing deterministic analysis engine (`src/modules/processing/spreadsheet/`) was already sound — structured, provider-agnostic, already wired into chat, Universal Search, and the Knowledge Graph via the generic document pipeline. Two confirmed, narrow defects blocked real acceptance questions; both were fixed in the same engine, no second engine built.

## What was fixed

Both changes are in `src/modules/processing/spreadsheet/workbookAnalysis.ts`, `analyzeSheet`'s aggregate computation. No new files, no new tables, no edge function changes.

**1. Bare month-label period columns were invisible to grouping.** `detectColumnMeaning` tags any header matching a date-ish regex (`month`, `date`, `period`, ...) as `meaning: 'timeline'` regardless of whether the values parse as absolute dates. A real-world "Month" column with values like `Jan`/`Feb`/`Mar` (no year — extremely common) never resolves to `dataType: 'date'` (`parseDateValue("Jan")` is `Invalid Date` — verified directly with Node before writing any fix), so it fell through to `dataType: 'category'`, but was still excluded from every breakdown because breakdown eligibility only checked `meaning === 'category'`. Fix: category-breakdown eligibility now also includes `meaning === 'timeline'` columns whose `dataType` isn't a genuine `'date'` — i.e., exactly the case where detection landed on "this is a period label" but has no absolute value to build a real month-grouped trend from. Genuine date columns are untouched and still use the existing `trends` (month-grouped) path, so nothing is computed twice.

**2. Category breakdowns were only computed for one "primary" numeric column.** With Revenue and Cost both present, only Revenue-by-Product was ever built — Cost-by-Product didn't exist, so a "which product had the highest gross profit" question had no per-product cost figure to read, only a whole-column Cost sum. Fix: `categoryBreakdowns` is now the full (category column × numeric column) product, capped at `MAX_BREAKDOWNS_PER_SHEET = 20` per sheet as a safety bound (mirrors the existing `MAX_CATEGORY_ROWS`/`MAX_ANOMALIES` caps in `aggregates.ts`) so a wide sheet can't blow up the grounding text.

Both fixes are additive filters/loops over already-existing, already-tested pure functions (`computeCategoryBreakdown`) — no new calculation logic, no new dependency, and the pre-existing `workbookAnalysis.test.ts`/`aggregates.test.ts`/`formatForChat.test.ts` suites all still pass unchanged.

## What was intentionally not changed

- **Formula text / cell coordinates as a structured (Sheet, Cell, Formula, Value) triple** — discovery confirmed this doesn't exist (only a per-column `hasFormulas` boolean). Not built: no acceptance test (A–J) requires it, and it's a genuinely separate feature (capturing every formula cell's address, a new shape, a new grounding surface) — building it here would violate the sprint's own "implement only what's necessary" rule.
- **`.xls` (legacy binary Excel) ingestion** — not registered in `DocumentFileType`. Not required by the task's acceptance tests; the task itself phrases this as optional.
- **The artifact-generation module** (`src/modules/ai/artifacts/spreadsheet/*`, "NOVA creates a new spreadsheet") — confirmed to be a genuinely different capability, not touched.
- **"Chat with NOVA" wording** — spreadsheets use the same generic entry point every document type does, not a spreadsheet-specific "Analyze with NOVA" label. Renaming it is a platform-wide UX change outside this sprint's scope; the existing wording already satisfies the task's "or an equivalent existing PIP interaction" allowance.
- **Knowledge Graph / Universal Search expansion** — spreadsheets already participate via the generic document pipeline (chunking, embedding, `runKnowledgeExtractionFromContent` are all file-type-agnostic). Nothing new was added, per the task's explicit "do not expand the Knowledge Graph unnecessarily" instruction.

## Acceptance Tests A–J

Evaluated against the deterministic calculation layer directly (`workbookAnalysis.acceptance.test.ts`), using the exact fixture from Phase 8 (`__fixtures__/salesExpensesWorkbook.ts`). Every total below was independently computed with a standalone script before any test was written, not derived from the code under test.

| Test | Result | Notes |
|---|---|---|
| A — sheets & contents | 🟢 Grounded | `formatSpreadsheetContextText` names each sheet, row/column counts, columns with detected meaning |
| B — total revenue | 🟢 **57,000** | Exact match |
| C — highest-revenue product | 🟢 **Product A** (31,000 vs 26,000) | Exact match |
| D — compare A vs B | 🟢 **A=31,000, B=26,000** | Exact match |
| E — highest-revenue month | 🟢 **February — 20,000** | **Correction, not a bug**: February and March are numerically tied at 20,000 (verified independently). The task's fixture data produces a genuine tie; PIP's deterministic ranking picks February by stable insertion-order tiebreak, matching the task's stated expectation, but the tie itself is real and worth knowing before treating "February uniquely won" as ground truth. |
| F — highest-gross-profit product | 🟢 **A=13,500, B=12,000** | Exact match; this is the fix under test (Cost-by-Product didn't exist before) |
| G — Operations department expenses | 🟢 **7,900** | Exact match |
| H — strongest combined month (revenue − cost − opex − marketing) | 🟢 Computable from both sheets | No baked expected value in the task. Computed: Jan=3,000, Feb=4,500, **Mar=5,100 (strongest)** |
| I — business insights | 🟢 Grounded | Sum/best/worst figures for both sheets are present in the single `<spreadsheet_analysis>` block reaching the model |
| J — "why was February stronger than March?" | 🟡 See note | Revenue is tied (Feb=Mar=20,000); **March actually had higher gross profit (9,500 vs 9,000) and higher combined performance (5,100 vs 4,500) than February.** The task's Test J premise doesn't hold against the fixture's own numbers. This isn't a defect to fix — it's exactly the scenario Phase 10 asks for: a well-grounded answer should say revenue was tied and, if anything, March was stronger on profit, rather than inventing a justification for a false premise. What's verified: the correct per-month figures for both metrics reach the model on every turn (`AIService.test.ts`, "Spreadsheet analysis context integrity"), and are not history-dependent. Whether a live model actually declines the false premise is not something this environment can execute (see "Not verified" below). |

## Automated tests (Phase 11)

29 new tests across 6 files, all deterministic where the underlying calculation is deterministic (Phase 11's own instruction — not relying on LLM-generated assertions):

- `workbookAnalysis.test.ts` (+3) — pins the two fixes at the smallest unit level: month-label grouping, per-numeric-column breakdowns, no double-counting for genuine date columns.
- `workbookAnalysis.acceptance.test.ts` (new, 7 tests) — Tests B/C/D/E/F/G/H against the Phase 8 fixture, plus cross-sheet grounding-text presence.
- `extractors/spreadsheet.test.ts` (new, 5 tests) — real `XLSX.write`/`XLSX.read` round trip: multi-sheet extraction, formula-column detection off the raw worksheet, header-only-sheet handling, and a real CSV file through the identical code path.
- `api/retrieveSpreadsheetContext.test.ts` (new, 4 tests) — no-documentId short-circuit, grounding text on a spreadsheet document, null for a non-spreadsheet document, never-throws on a Supabase failure.
- `AIService.test.ts` (+4, "Spreadsheet analysis context integrity") — the `<spreadsheet_analysis>` block reaches the actual provider request (not just an intermediate function), is absent when there's no documentId, is recomputed (not just replayed via history) on a follow-up turn, and routes through the identical provider/fallback shape as any other message.

Full suite: `tsc -b` clean · `vitest run` all passing (see Phase 15 below for the exact count) · `oxlint` clean · `vite build` succeeds.

## Security verification (Phase 12)

No new attack surface: no new database table, no new RPC, no new edge function, no change to any RLS policy. `documents`/`document_chunks`/`extraction_metadata` RLS (owner + workspace-member scoping, `0031_shared_knowledge_objects.sql`) is unchanged and applies to spreadsheets exactly like every other document type — verified by reading the migration directly, not assumed. Spot-checked the touched/added files for `console.log`/`.rpc(`/provider-id leakage: none found. Provider secrets remain server-side only (`ai-chat` edge function, unchanged, still v18 — no drift, verified via `mcp__Supabase__list_edge_functions`).

## Mobile (Phase 13)

Regression check only, no dedicated mobile work. `SpreadsheetGridView.tsx` already wraps its table in `overflow-auto` with a 500-row/50-column display cap and an explicit "full sheet is still fully searchable and chattable" note; `SpreadsheetSummaryCard.tsx` uses a 2-column `dl` grid, which reflows fine at narrow widths. No spreadsheet-specific mobile regression was found or introduced.

## Not verified (named explicitly, not glossed over)

Per this engagement's standing rule (Milestones 1/10 and 2/10 reported the same limitation): this environment has no authenticated browser session against the deployed app, so Phase 9's *live* acceptance script — actually uploading the workbook and reading NOVA's real chat replies — was not run. What's verified instead: the exact figures the model would be grounded in are mathematically correct (deterministic tests above), and those figures demonstrably reach the real provider request boundary (`AIService.test.ts`), on every turn, not just the first. Whether the live model phrases Test I's insights well or correctly declines Test J's false premise is not something this session can execute or claim.

## Deployment status

No edge function changes were required — spreadsheet grounding text is assembled client-side and appended to the same `system` string every other context source already uses; `ai-chat` (v18) already accepts an arbitrary system prompt and needed no changes. Verified not-stale via `mcp__Supabase__list_edge_functions` before concluding no redeploy was needed, per this sprint's own critical rule.
