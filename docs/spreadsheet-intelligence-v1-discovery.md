# Spreadsheet Intelligence v1 — Discovery (PIP Sprint 3/10)

Baseline: Milestone 1/10 (Image) and 2/10 (Note) both 🟢 100% PASS, `HEAD` at `a1fc59e`. Working rule honored: nothing was implemented until the existing spreadsheet architecture was fully read and traced end to end.

## Two subsystems, correctly distinct

Found two spreadsheet-related module trees; confirmed they solve different problems, not duplicated engines:

- `src/modules/processing/spreadsheet/` + `extractors/spreadsheet.ts` + `api/retrieveSpreadsheetContext.ts` + `reader/spreadsheet/*` — **analyzes an uploaded spreadsheet**. This sprint's subject.
- `src/modules/ai/artifacts/spreadsheet/*` + `workspace-actions/actions/generateSpreadsheetCommand.ts` — **NOVA generates a new spreadsheet as output** (`"create a spreadsheet for X"`). Untouched; out of scope.

## Phase 1 — Discovery answers

**1. Ingestion.** `.xlsx`, `.csv`, `.ods` are registered file types (`extractors/registry.ts`) and all three route through the same `extract()` in `extractors/spreadsheet.ts`, backed by SheetJS (`XLSX.read`). Verified end to end with a real in-memory `.xlsx` (`XLSX.write`/`XLSX.read` round trip) and a real CSV blob — both parse correctly (`extractors/spreadsheet.test.ts`, new this sprint). Legacy binary `.xls` is **not** registered (`DocumentFileType` only lists `xlsx | csv | ods`) — a real limitation, but the task's own phrasing treats it as optional ("if supported"), and it's not exercised by any of Phase 9's acceptance tests, so it wasn't added. Named, not fixed.

**2/3. Workbook structure and semantics.** `analyzeSheet` (`workbookAnalysis.ts`) already builds a real structured `SheetAnalysis`, not flattened prose: per-column `dataType`/`meaning` detection (currency/date/category/entity/identifier/metric — deterministic header + value heuristics, `columnAnalysis.ts`), a financial-pattern classifier (`financialPatterns.ts`), and aggregates (sum/avg/min/max, category breakdowns, month-grouped trends, z-score anomalies — `aggregates.ts`). This is genuinely structured, reused as-is.

**4/5. Question-answering and multi-sheet reasoning.** The extraction pipeline treats each sheet as a "chapter" (same contract PDF/EPUB extraction already uses — `processDocument.ts` is completely file-type-agnostic), so spreadsheets are chunked/embedded and RAG-searchable exactly like any document. On top of that, `formatSpreadsheetContextText` (`formatForChat.ts`) formats the *entire* workbook's precomputed figures — every sheet, in one block — into a `<spreadsheet_analysis>` tag `buildSystemPrompt.ts` appends to every chat turn scoped to that document (`AIService.ts` calls `retrieveSpreadsheetContext(documentId)` unconditionally, every turn — not gated by turn count). This is why multi-sheet and follow-up reasoning work by construction, the same way full-history replay made Note follow-up work in Sprint 2.

**6. Formulas vs. values.** `extractors/spreadsheet.ts` reads the raw `WorkSheet`'s cell objects (`.f`) to detect *which columns* contain formulas (`formulaColumnIndexes`), and `analyzeSheet` surfaces this as a per-column `hasFormulas: boolean`. It does **not** preserve formula text, cell coordinates, or a paired (formula, value) structure per the task's own "Sheet: Sales, Cell: F12, Formula: =SUM(F2:F11), Value: 154000" example — this is confirmed ⚪ MISSING. No Phase 9 acceptance test (A–J) requires it, and building full per-cell formula/coordinate preservation is a real, separate feature (capturing every formula cell's address across every sheet, a new structured shape, new UI/grounding surface). Per this sprint's own "only implement what's necessary" rule, this was **not** built — named as a real limitation for a future sprint, not silently dropped.

## Phase 2 — Gap analysis

| Capability | Status | Notes |
|---|---|---|
| xlsx/csv/ods ingestion | 🟢 WORKING | Verified via real file round-trips |
| .xls (legacy binary) | ⚪ MISSING | Not required by acceptance tests; named limitation |
| Workbook/sheet/column/header detection | 🟢 WORKING | `analyzeSheet` |
| Genuine full-date columns | 🟢 WORKING | `parseDateValue` + month-grouped `trends` |
| **Bare month-label period columns ("Jan"/"Feb", no year)** | 🔴 BROKEN → 🟢 FIXED | See Phase 4 |
| Formula/calculated-value column detection | 🟢 WORKING | Column-level `hasFormulas`, last-saved value in text |
| Formula text + cell coordinate + value as structured triples | ⚪ MISSING | Not required by Tests A–J; deliberately deferred |
| Semantic column meaning (Revenue/Cost/Category/etc.) | 🟢 WORKING | Generic header+value heuristics, not a hardcoded metric list |
| Single-column totals/min/max/avg (Test B) | 🟢 WORKING | `computeColumnStats` |
| Category breakdown, e.g. revenue by product (Test C/D) | 🟢 WORKING | `computeCategoryBreakdown` |
| **Breakdown for every numeric column, not just one (Test F: cost by product)** | 🔴 BROKEN → 🟢 FIXED | See Phase 4 |
| Period ranking, e.g. highest-revenue month (Test E) | 🔴 BROKEN → 🟢 FIXED | Same fix as above — the month column is a "category-shaped" timeline column |
| Cross-sheet combination (Test G/H) | 🟡 PARTIAL → 🟢 FIXED | Numbers existed per-sheet; the month/product breakdown fix is what makes them combinable |
| Multi-sheet grounding in one prompt block | 🟢 WORKING | `formatSpreadsheetContextText` already iterates every sheet |
| Follow-up context retention (Test J) | 🟢 WORKING | Recomputed every turn via `documentId`, not dependent on history replay |
| Universal Search / Knowledge Graph participation | 🟢 WORKING | Free via the generic document pipeline — no file-type gating anywhere in chunking, embedding, or `runKnowledgeExtractionFromContent` |
| Provider routing (fallback/governance/Pro) | 🟢 WORKING | No spreadsheet-specific provider path exists anywhere |
| "Analyze with NOVA"-equivalent entry point | 🟢 WORKING (named wording gap) | "Chat with NOVA" — same generic action every document type uses, not spreadsheet-specific wording; not changed (see Phase 7 below) |
| Mobile grid/summary rendering | 🟢 WORKING | Existing `overflow-auto` grid + row/col display caps |

## Phase 3 — Core intelligence contract

The existing architecture already matches the stated principle ("a spreadsheet is structured information, not a document") at the Workbook → Sheet → Column/Row/Cell level, and preserves it as real objects (`SheetAnalysis`), not prose, all the way to the chat prompt (`<spreadsheet_analysis>` tag, distinct from `{{context}}`). The one place it fell short of that principle — Formula → Cell → Value as a named structure — is recorded as a known limitation, not built this sprint, since nothing in Phase 9 needs it and the task explicitly says not to implement every gap.

## Phase 7 — UX audit

The entry point from a spreadsheet document to chat is the same "Chat with NOVA" link every document type gets (`DocumentCard.tsx`/`DocumentDetailPage.tsx` → `/chat?documentId=`), not a spreadsheet-specific "Analyze with NOVA" button. This already satisfies the task's own "or an equivalent existing PIP interaction" allowance, and renaming it would be a platform-wide wording change touching every document type, well beyond this sprint's spreadsheet-only scope — left as-is, named here rather than silently changed.
