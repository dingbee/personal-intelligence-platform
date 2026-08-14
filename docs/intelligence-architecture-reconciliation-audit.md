# ARRIYIA — Intelligence Architecture Reconciliation + Data Intelligence Audit

Status: **AUDIT ONLY — no implementation in this phase.** Baseline: P0 (`2252034`), P1 (`8b7339c`), Chat Outlining (`9f89cb5`), Founding Pro Phase 4 (`f22330c`).

---

## 1. Executive Assessment

ARRIYIA's entitlement, capability-registration, and workspace architecture (P0 + P1) are sound and genuinely reusable — they need extension, not replacement, to support Student/Pro/Enterprise. The gap is not in "how do we gate a new capability" (solved) but in "what does the capability actually compute." The Excel benchmark exposed the real foundational problem: **the complete structured dataset does not survive past document processing.** Everything the AI layer can currently see about a spreadsheet is either (a) a fixed battery of pre-computed summary statistics decided at upload time, or (b) lossy, potentially row-broken markdown-table text fragments from RAG. There is no queryable structured substrate, so any question the upload-time statistics battery didn't anticipate is architecturally unanswerable today — not a prompting problem, a data-availability problem. This is the correct next problem to solve, and it is a genuinely separate architectural layer from everything built in P0/P1.

Image Intelligence is validated and reusable as a *pattern* (one vision call, self-reported confidence, Document Intelligence reused as-is against extracted text) but is **not capability-registered** and has **no Pro gating** today — this matters for the tier reconciliation. Voice Intelligence and Professional Domain Intelligence are confirmed to not exist in any form, not even a stub — clean ground, no legacy to reconcile against.

The single biggest architectural risk is treating "Data Intelligence" as another RAG-style capability. It is not. It requires a deterministic execution layer that the LLM plans against and interprets the output of, not one that the LLM is asked to compute over raw or chunked text. Section 11 (Data Intelligence Architecture Recommendation) is the load-bearing recommendation of this report.

---

## 2. P0/P1 Architecture Audit

**P0 — Pro Intelligence Foundation** established exactly one new fact and two new mechanisms, reusing everything else:
- **Fact**: `feature:pro_intelligence` — a `plan_quotas` row (`quota_key = 'feature:pro_intelligence'`, value 0/1) seeded for `pro` and `founding_pro` plan rows only. Resolved via the pre-existing `has_feature(user_id, key)` → `resolve_effective_quota_limit(user_id, 'feature:' + key)` chain (same machinery `feature:collaboration` already used). No new table, no new RPC.
- **Client mechanism**: `useHasProIntelligence()` (thin wrapper over `useHasFeature`) and `RequireProIntelligence` (route guard, mirrors `RequireAdmin`). Both are UX hints only.
- **Server mechanism**: `AICapability.requiredFeature?: string` — an optional field on the existing capability-registration shape. `runCapability` checks it via `hasFeature(userId, capability.requiredFeature)` *before* resolving a prompt template or calling a provider, and throws if false. This is the one and only server-authoritative Pro gate for AI capabilities today.
- Founding Pro receives `pro_intelligence` automatically and identically to Pro — both plan codes carry the same seeded value, resolved through the same `user_plan_assignments` row every plan check reads. No Founding-Pro-specific code exists or is needed.

**P1 — Advanced AI Workspace** discovered (not built) that a mature `workspaces` system already existed — multi-workspace-per-user, `workspace_members` with owner/editor/viewer roles, user-initiated creation, `conversations.workspace_id` already live-threaded through `AIService.sendMessage`/`runCapability`, retrieval (`retrieveMemoryContext`, `retrieveContext`) already scoping by workspace, and `WorkspaceIntelligenceHubPage` already computing rich deterministic state (`buildWorkspaceHubState`: maturity, gaps, recommendations, health, `workspace_objectives`). P1 shipped exactly one new capability (`workspace-briefing`, an LLM narrative synthesis over that pre-existing deterministic state) with zero schema changes.

**Capability registry mechanics** (relevant to Student/Pro/Enterprise): a domain module calls `registerPlatformModule({ id, name, capabilities: AICapability[], prompts: PromptTemplate[] })` once, at app boot (`App.tsx` side-effect imports). `AICapability = { id, label, description, moduleId?, requiredFeature? }`. Execution is fully decoupled from registration: `runCapability(capabilityId, variables, userId, workspaceId, ...)` looks up the capability + its active `PromptTemplate`, checks `requiredFeature` if set, resolves a provider, and streams. **This is already tier-agnostic** — `requiredFeature` is just a string key into the `feature:` quota namespace, so it can point at any future key (`feature:academic_intelligence`, `feature:organizational_intelligence`, etc.) with zero architecture change. It cannot today express *degrees* of a capability (e.g. "Student gets bounded autonomy, Pro gets full autonomy on the same capability") — see §5 and §7.

---

## 3. Student / Pro / Enterprise Reconciliation

The existing `plans`/`user_plan_assignments`/`plan_quotas` architecture supports this cleanly **as entitlement**, with one caveat (autonomy — §7).

- **`plans` already supports arbitrary new plan codes.** Adding `student` and (if not already present as a first-class plan rather than a UI label) `enterprise` is a one-row insert into `plans`, exactly like `founding_pro` was. Confirmed precedent: `plans.code` has no fixed enum, `plan_quotas`/`plan_ai_providers`/`user_plan_assignments` all key off `plan_id` generically.
- **Student should be a plan**, not a new construct. It needs its own `user_plan_assignments` row (so a student can be billed/resolved distinctly from Free/Pro) and its own `feature:*` grants in `plan_quotas` — not a capability profile layered on top of Free, and not a discount flag on Pro. This matches the brief's "Student is not cheap Pro."
- **Enterprise should remain a plan** for the entitlement question ("can this account use organizational features at all"), but Enterprise's actual differentiator — organization-wide knowledge/workflows/permissions/governance — is a *workspace-membership and role* question, not a *quota* question. That already has a real substrate: `workspace_members`/`workspace_member_role` (owner/editor/viewer). Enterprise's governance model should extend workspace roles/permissions, not be invented as a second permission system. (`enterprise`/`business` plan codes already exist as literals in a handful of UI files per the P0 audit — pre-existing, unrelated to this reconciliation, worth noting but not touching now.)
- **Capability access should stay in `plan_quotas`** via the `feature:` namespace — exactly as `pro_intelligence` already does. One `feature:<capability-family>` key per gated capability family (e.g. `feature:academic_intelligence`, `feature:data_intelligence`, `feature:organizational_intelligence`), each capability's `requiredFeature` pointing at the appropriate key. This avoids a second entitlement system by construction.
- **A separate capability-policy abstraction is likely necessary, but not as a competing entitlement system** — as a thin *autonomy* layer sitting *on top of* the existing boolean gate. See §7 for the recommended shape (capability metadata + orchestration-time policy, not a new table).
- **Quotas and capabilities should remain separate concepts**, as they already are: `plan_quotas` already stores both quantitative limits (`ai_messages`, `storage_bytes`) and boolean feature flags (`feature:*`) in the same generic `(plan_id, quota_key) → value` shape without conflation — this pattern already answers "should they remain separate" (yes, they're namespaced apart, resolved through the identical mechanism, no new table needed for either).

**Critical requirement met by construction**: extending this design introduces *zero* new entitlement mechanism. Every new tier/capability is a new `plans` row + new `plan_quotas` rows + a `requiredFeature` string on new capabilities — all through code paths that already exist and are tested.

---

## 4. Capability Matrix

**E** = Existing and gated appropriately today · **e** = Existing but *not yet gated* (works for everyone, including Free) · **P** = Proposed (architecture supports it, not built) · **F** = Future (needs new capability work first) · **✓** = organization-scoped, Enterprise only by nature.

| Capability | Free | Student | Pro | Enterprise |
|---|---|---|---|---|
| Core AI (chat) | E | E | E | E |
| Document Intelligence | e | e | e | e |
| Image Intelligence | e | e | e | e |
| Voice Intelligence | — | — | F | F |
| Knowledge Intelligence (graph, gaps, briefing) | e | e | e | e |
| Basic Data Intelligence (upload-time spreadsheet stats — existing) | e | e | e | e |
| Advanced Data Intelligence (arbitrary deterministic query engine) | — | P (bounded) | F | F |
| Guided Analysis | — | P | — | — |
| Autonomous Analysis | — | — | F | F |
| Academic Intelligence | — | F | — | — |
| Research Intelligence | — | P (bounded) | F | F |
| Critical Intelligence | — | — | F | F |
| Synthesis Intelligence | — | — | F | F |
| Planning Intelligence | — | — | F | F |
| Decision Intelligence | — | — | F | F |
| Strategic Intelligence | — | — | F | F |
| Professional Domain Intelligence (Marketing/Finance/Sales/...) | — | — | F | F |
| Organizational Intelligence | — | — | — | ✓ F |

Notes:
- **Document/Image/Knowledge Intelligence are marked `e` (existing, ungated) everywhere including Free** — this is factual, not a recommendation. `analyze-document-intelligence` and the image vision call carry no `requiredFeature` today (confirmed §2 of the parallel audit). Whether that's correct product policy is a tier-design decision for the approval step, not something to silently change here.
- **Workspace Briefing** (P1's shipped capability) is `pro_intelligence`-gated today (Pro + Founding Pro `E`, Free denied) and isn't listed above as its own row since it's an instance of "Synthesis Intelligence," not a distinct product capability.
- Everything in the `Research → Organizational` block is genuinely unbuilt; none of it should be inferred as "close" — Research Intelligence in particular has real prior-implementation work that was deferred (§13), not abandoned, but no code exists yet.

---

## 5. Autonomy Model

Recommend representing autonomy as **capability metadata consumed by an orchestration-time policy — not a separate entitlement, not a router/model policy.**

Concretely, extend `AICapability` (already extended once in P0 with `requiredFeature`) with an optional autonomy descriptor, e.g. `autonomyEnvelope?: { maxSteps: number; allowedTools: string[]; requiresConfirmation: boolean }` (illustrative shape, not to be implemented now). The same capability id (say, `research-brief`) could be registered once with a *per-tier envelope resolved at runCapability time* — Student's envelope caps step count and tool surface, Pro's envelope is broader, Enterprise's spans workspace-wide/multi-member context. This is the mechanism that satisfies "Student is not cheap Pro / Pro is not more Student" without registering three near-duplicate capabilities per intelligence type.

Why this shape, not the alternatives:
- **Not a separate entitlement** — autonomy always co-occurs with a `requiredFeature` check (you can't get an autonomy envelope without first passing the plan gate), so folding it into a second gate would just be enforcing the same fact twice.
- **Not pure orchestration policy divorced from the capability** — the reasoning/planner module (`buildReasoningPlan`, `src/modules/intelligence/planner/`) already computes a `ReasoningPlan` per turn from intent + signals, entirely deterministically, with **zero AI calls**. This is the natural home for autonomy resolution: the planner already decides `requiredContext`/`responseStrategy`/`suggestedCommandIds` per turn; extending it to also resolve "how many autonomous steps is this tier allowed for this capability" is additive to a proven, already-tested deterministic module, not a new subsystem.
- **Not a model/router policy** — `resolveProviderChain` governs *which provider*, not *how much the AI is allowed to do*. Conflating the two would make provider selection tier-aware in a way that has nothing to do with model capability, and would recreate P0's provider-gating logic for a different concern.

This is a genuine open design question, not a solved one — flag it explicitly for the approval step before Data Intelligence work begins, since Data Intelligence's own "how many analytical steps can Student vs Pro run autonomously" question depends on this model existing.

---

## 6. Multimodal Architecture

Text and Documents are fully converged (same tables, same retrieval, same chunking). Images converge at the *behavioral* layer only — `analyzeImage` reuses Document Intelligence's structured-extraction chain against its own transcribed text, and confidence/provenance vocabulary is shared — but storage is genuinely siloed: `documents`+`document_chunks`+`embeddings` vs. `note_embeddings` vs. `asset_embeddings`, three separate tables and three separate `match_*` RPCs, unified only by an identical shape and RLS pattern, and by the `search` module's provider registry pattern (one file per source, same hybrid scoring, registered into one `searchProviderRegistry`).

Structured Data is the least converged of all: SheetJS extraction happens in an isolated processor, its output forks two ways (prose chunks into the *same* `document_chunks`/`embeddings` tables documents use — so at the storage layer spreadsheets already share the document pipeline for RAG purposes — and summary-statistics JSON into `extraction_metadata`, a table no other content type populates this heavily). Voice does not exist, so there's nothing to reconcile yet, only a target shape to design toward.

**Recommendation**: do not force full storage unification now (that's the "Do not redesign Workspace" trap in a different guise — a big storage migration for four content types is exactly the kind of premature architectural cleanup this audit is supposed to prevent). Converge where it's cheap and already happening (retrieval/search provider pattern, structured-extraction chain, provenance vocabulary, confidence vocabulary) and let Structured Data's *deterministic execution layer* (§11) be the next genuinely new convergence point — every content type's evidence should ultimately be describable in one common "Evidence Substrate" shape at the *retrieval* layer even while storage stays per-type, matching the existing search-provider precedent exactly.

---

## 7. Data Pipeline Audit — Exactly What Happens to Excel/CSV Today

*(Full detail in the standalone structured-data audit that fed this report; summarized here.)*

1. **Upload**: `UploadDropzone` detects `.xlsx`/`.csv`/`.ods` by file extension only (`fileTypes.ts`). Raw file uploaded via `uploadDocument()` to the private `documents` Storage bucket, retained indefinitely (never deleted post-processing).
2. **Extraction**: `spreadsheet.ts` (SheetJS/`xlsx` npm package) reads **every populated cell** into a `unknown[][]` grid per sheet via `sheet_to_json(sheet, { header: 1 })`. Formula cells resolve to last-saved values only — formulas are never recalculated, and the formula string is discarded (only a boolean "this column had formulas" flag survives).
3. **"Sheet-per-chapter"**: each sheet becomes one `ExtractedChapter { title: sheetName, text }`, deliberately reusing the PDF/EPUB chapter contract so existing chapter-aware chunking/summarize/flashcards work unmodified. The chapter's `text` is a **markdown-table-serialized string** — prose, not structured data. Row/column addressability is lost at this exact step.
4. **Column/type/pattern detection**: `columnAnalysis.ts` classifies each column's `ColumnDataType`/`ColumnMeaning`/currency via header-regex + value-sample heuristics — pure, deterministic, computed once at processing time, persisted as JSON.
5. **Chunking**: the same generic `paragraphChunker` used for every document type splits the markdown table on blank lines (there are none inside a table) then hard-splits on character position past 1200 chars — **no row/column awareness**, so chunks for any sheet of moderate size can cut mid-row.
6. **Embedding/indexing**: identical pipeline to every other document — batched OpenAI embeddings into the shared `embeddings`/`document_chunks` tables. No spreadsheet-specific vector store.
7. **"Spreadsheet Intelligence" analysis**: `aggregates.ts` computes, once, at upload time, over the full grid: per-column sum/average/min/max, top-10 category-breakdown-by-sum with best/worst, monthly-grouped trend totals + one growth-rate formula, top-5 z-score anomalies, and a regex-based sheet-pattern classification (income-statement/expense-sheet/etc.). This is **a fixed battery of pre-computed summary statistics, not a query engine** — no filter predicate, no arbitrary group-by, no cross-sheet join, computed identically regardless of what a user will later ask.
8. **AI context**: `retrieveSpreadsheetContext(documentId)` reads only the persisted summary-statistics JSON (never re-parses the raw file) and formats it into a `<spreadsheet_analysis>` prompt block. Separately, ordinary RAG retrieval may also surface markdown-table chunk fragments into the regular context block. The LLM never sees the full grid.

---

## 8. Complete Dataset Availability

**No.** The complete structured dataset does not survive into a queryable form anywhere past the extraction step.

The parsed `rows: unknown[][]` grid exists only as a local variable inside `extract()` in `spreadsheet.ts`. It forks two ways — into lossy prose chunks (RAG) and into a small, fixed set of pre-computed aggregates (`extraction_metadata.metadata.spreadsheet`) — and is then discarded. Nothing downstream re-persists it in row/column-addressable form. The **only** place all 1,500×19 values still exist post-processing is the original file sitting untouched in Supabase Storage, and that file is re-parsed exclusively by the human-facing Reader grid view (client-side, on demand) — **never** by the chat/AI code path. `AIService.sendMessage`'s spreadsheet context is built exclusively from the persisted summary JSON.

Practical consequence: a question the upload-time statistics battery didn't anticipate — any ad hoc filter/group/comparison not already in the fixed battery (e.g. "sum of Product X sales in Region Y for Wholesale customers only, June–December 2024") — has literally no structured evidence available to answer it from. This is not a prompting or retrieval-tuning problem; it's a missing architectural layer.

---

## 9. Existing Analytical Infrastructure

The closest thing to a reusable deterministic computation engine is `src/modules/processing/spreadsheet/aggregates.ts` + `columnAnalysis.ts`, and it is explicitly **not** designed as one: it's a fixed, non-parameterized battery run once per sheet at processing time. Its component functions (`computeColumnStats`, `computeCategoryBreakdown`, `computeTrend`, `detectAnomalies`) do real, reusable arithmetic (sum/average/min/max, group-by-and-sum, chronological grouping + growth rate, z-score outliers) and their low-level cell-parsing helpers (`cellParsing.ts`) are genuine building blocks worth reusing — but none of it is callable with arbitrary user-specified filter/dimension/measure parameters. No other module in the codebase implements a general filter/group/aggregate/sort engine over arbitrary tabular data; the only other `sum`/`average`/`percentile` code found is narrow, single-purpose (AI observability latency stats, admin dashboard counters, knowledge-graph edge counts) and not reusable for this purpose.

**Conclusion**: a real Data Intelligence query engine has to be built from scratch. `aggregates.ts`'s arithmetic primitives and `cellParsing.ts`'s value-normalization helpers are worth reusing as building blocks; the module itself is not the engine.

---

## 10. Excel Benchmark Mapping

Dataset: ~1,500 transactions × 19 fields (Region, Product, Store, Salesperson, CustomerType, Quantity, UnitPrice, Discounts, Promotions, Returns, Shipping, Payment, order/delivery dates), 2023–June 2025.

| # | Question | Dimension(s) | Measure | Aggregation | Filter | Order/Limit |
|---|---|---|---|---|---|---|
| 1 | Which salesperson generated the most total sales? | Salesperson | Quantity×UnitPrice−Discounts | SUM | — | DESC, limit 1 |
| 2 | What is the return rate by region? | Region | Returns / Orders | COUNT ratio | — | — |
| 3 | What is the return rate by product? | Product | Returns / Orders | COUNT ratio | — | — |
| 4 | How do Retail vs Wholesale customers compare in total sales? | CustomerType | TotalPrice | SUM | CustomerType ∈ {Retail, Wholesale} | grouped comparison |
| 5 | What were total annual sales, 2023 vs 2024? | Year(OrderDate) | TotalPrice | SUM | — | comparisonPeriod: YoY |
| 6 | What is month-over-month sales growth? | Month(OrderDate) | TotalPrice | SUM + growth% calc | — | chronological |
| 7 | What are monthly sales totals by region? | Region × Month | TotalPrice | SUM | — | multi-dimensional grouping |
| 8 | What is average delivery time by store? | Store | DeliveryDate − OrderDate | AVG | — | — |
| 9 | What share of orders used each payment method? | Payment | Order count | COUNT + % of total | — | — |
| 10 | Which products have the highest discount rates? | Product | Discount / UnitPrice | AVG | — | DESC, limit N |
| 11 | Do promoted orders have a higher average value than non-promoted? | Promotion (bool) | TotalPrice | AVG | Promotion ∈ {true,false} | grouped comparison |
| 12 | Top 5 stores by revenue, H1 2025 | Store | TotalPrice | SUM | OrderDate ∈ [2025-01, 2025-06] | DESC, limit 5 |
| 13 | Is there a relationship between shipping cost and order quantity? | Shipping, Quantity | — | correlation | — | *(Analysis Intelligence, not pure aggregation — see §12)* |
| 14 | Which salesperson has the highest return rate? | Salesperson | Returns / Orders | COUNT ratio | — | DESC, limit 1 |

Rows 1–12, 14 are pure Data Intelligence (deterministic, no interpretation required). Row 13 is deliberately included to illustrate the boundary in §12 — a correlation coefficient is a deterministic *calculation*, but "is there a relationship" and "what might explain it" cross into Analysis Intelligence.

---

## 11. Data Intelligence Architecture Recommendation

Smallest reusable architecture, matching the brief's own pipeline shape:

```
Structured Dataset (full grid, persisted queryable — NEW, does not exist today)
        ↓
Schema / Data Profile (EXISTS — columnAnalysis.ts's type/meaning detection, extend to cover the full dataset not just a display summary)
        ↓
Analytical Query / Plan (NEW — the {source, dimensions, measures, filters, aggregation, grouping, ordering, limit} shape, see §13)
        ↓
Deterministic Execution (NEW — a query engine executing the plan against the persisted grid; aggregates.ts's arithmetic is reusable inside it)
        ↓
Validation (NEW — did the plan reference real columns/types; can it actually be computed from what's available)
        ↓
Provenance (PARTIAL — resolveChunkProvenance's pattern extends naturally: file, sheet, row range, columns touched)
        ↓
Verified Result (NEW — structured: numbers + which rows/filters produced them + confidence that the computation is complete)
        ↓
LLM Interpretation (EXISTS as a pattern — runCapability/streamChatCompletion; the LLM is handed the Verified Result, not raw data)
```

The single new foundational piece is **persisting the complete structured dataset in a queryable form** — without it, nothing downstream in this diagram is possible, no matter how good the query planner or interpreter are. This should be additive to, not a replacement of, the existing extraction pipeline: today's markdown-table chunking (for narrative RAG questions like "summarize this sheet") and today's upload-time summary stats (cheap, always-available headline numbers) both remain useful and should be preserved; the new persisted grid is a third, parallel representation, not a replacement for the other two.

The LLM's role is **planner + interpreter**, never calculator — it proposes an Analytical Query/Plan from the user's natural-language question and the Schema/Data Profile, the deterministic engine executes it, and the LLM interprets the Verified Result back into prose. This is the direct architectural expression of the brief's "the LLM should be an analytical planner + interpreter, not a spreadsheet calculator."

---

## 12. Analysis Intelligence Boundary

**Data Intelligence** = schema, profiling, filtering, aggregation, calculation, deterministic execution, validation, result structuring, provenance. Everything in §11's pipeline through "Verified Result." No interpretation, no comparison-with-meaning, no narrative.

**Analysis Intelligence** = interpretation, comparison, pattern recognition, anomaly *interpretation* (not detection — z-score anomaly *detection* is already deterministic, §9; *why* it's anomalous and whether it matters is Analysis), driver analysis, contradiction detection, follow-up-investigation framing, evidence-weighted conclusions, explicit limitations.

Row 13 in §10 is the clean test case: computing a Pearson correlation coefficient between Shipping and Quantity is Data Intelligence (deterministic, one formula, no ambiguity). Deciding whether that correlation is *meaningful*, what might *explain* it, and whether it supports a *business conclusion* is Analysis Intelligence — and per §14 (Epistemic Discipline), Analysis Intelligence must be able to say "the correlation is 0.31; that's weak and I cannot support a causal claim from this data alone" rather than overstating it.

Do not collapse these into one capability — the brief is explicit about this and the architecture in §11 makes the boundary a literal pipeline stage, not a soft convention.

---

## 13. Research Dependency

Research Intelligence is **deferred, not cancelled** — its prior implementation prompt should be preserved as-is for reactivation. Its correct dependencies, once Data/Analysis Intelligence exist:

- **Knowledge Intelligence**: Research must ground claims in the existing knowledge graph (`knowledge_nodes`, `knowledge_node_sources`, confidence scoring) rather than re-deriving facts the graph already has — reuse `getKnowledgeNodeEvidence`/`searchKnowledgeConcepts`, don't rebuild concept retrieval.
- **Data Intelligence**: a research question that requires "what does the data actually show" must delegate to the Data Intelligence layer's Verified Result, not ask the LLM to eyeball chunk text — this is the same discipline the Excel benchmark demanded, generalized.
- **Analysis Intelligence**: Research synthesizes across *interpreted* evidence (Analysis's output), not raw Data Intelligence results directly — Research sits one layer above Analysis in the dependency graph (§21).
- **Source/search infrastructure**: the existing `searchProviderRegistry` (documents/notes/assets/conversations/concepts, hybrid semantic+lexical) is Research's retrieval substrate — no new search system.
- **Workspace context**: Research should be workspace-scoped exactly the way Workspace Briefing already is (§2 of P1) — reuse `buildWorkspaceHubState`'s pattern of "compose from already-fetched deterministic state," don't re-fetch independently.
- **Provenance**: `resolveChunkProvenance` + `knowledge_node_sources` + `SourceReference` are the existing citation substrate — Research's citations should be an application of these, not a new citation system (§15/§21 both flag "do not invent a citation system").
- **Synthesis**: Research's output (a researched conclusion with citations) is itself an instance of Synthesis Intelligence, per the dependency graph in §21 — Research produces synthesized, cited findings; it does not have its own separate synthesis mechanism.

Correct future position: Research Intelligence is the first "Higher-Order Intelligence" built *after* Data Intelligence + Analysis Intelligence exist, because Research's core value proposition (grounded, non-hallucinated conclusions) is exactly what a real Data Intelligence substrate makes possible for the first time on structured evidence.

---

## 14. Professional Domain Architecture

No domain-specific intelligence exists today (§3 of the parallel audit, confirmed by targeted grep — zero hits). This is a clean design surface, not a reconciliation problem.

Recommendation, consistent with the brief: domains (Marketing, Finance, Sales, Strategy, Operations, HR, Hospitality) should be **prompt/context configurations that select and combine the shared intelligence substrate** (Knowledge + Data Intelligence + Analysis + Research + Planning + Decision), not isolated vertical products with their own extraction/retrieval/capability-registration stack. Concretely, a "Finance domain" capability would be a `PromptTemplate` specialized for financial framing (e.g. referencing the existing `classifyFinancialPattern`/financial-vocabulary detection from the spreadsheet module, §7 of the parallel audit — already-built domain signal, currently used only for sheet classification, reusable as a domain hint) layered on top of the same `runCapability`/Data Intelligence/Analysis Intelligence pipeline every other capability uses, gated by the same `requiredFeature` mechanism, not a parallel "Finance AI" system with its own tables or retrieval. This mirrors exactly how Image Intelligence already reuses Document Intelligence rather than inventing its own extraction chain (§1 of the parallel audit) — proven precedent for "generalize the core, specialize the framing."

---

## 15. Existing Work to PRESERVE

- **PRESERVE** — P0 entitlement architecture (`plans`/`user_plan_assignments`/`plan_quotas`/`has_feature`/`resolve_effective_quota_limit`), `feature:pro_intelligence`, `AICapability.requiredFeature`, `runCapability`'s entitlement check.
- **PRESERVE** — the capability registry (`registerPlatformModule`/`capabilityRegistry`/`promptRegistry`) and its decoupled registration/execution model.
- **PRESERVE** — Workspace architecture in full (`workspaces`/`workspace_members`/`workspace_objectives`, roles, `conversations.workspace_id`).
- **PRESERVE** — Workspace Intelligence Hub (`buildWorkspaceHubState` and every deterministic composer it calls — maturity, gaps, recommendations, health).
- **PRESERVE** — retrieval architecture (`retrieveMemoryContext`, `retrieveContext`, `retrieveAssetContext`, `retrieveNoteContext`, workspace-scoping behavior).
- **PRESERVE** — notes, memory, conversations as they stand.
- **PRESERVE** — Image Intelligence's *pattern* (single vision call, self-reported confidence + review threshold, Document Intelligence reuse) — reusable as-is for Data Intelligence's own confidence/provenance vocabulary.
- **PRESERVE** — current `AIService`/`streamChatCompletion`/provider-chain architecture — Data Intelligence's LLM interpretation step is a `runCapability` consumer, not a reason to touch the AI service.
- **PRESERVE** — the existing upload pipeline's extraction/chunking/embedding path for narrative RAG purposes — Data Intelligence is additive (a new persisted representation), not a replacement of this path.
- **PRESERVE** — quota infrastructure (`quotaService`, `consume_quota`, `resolve_effective_quota_limit`) — reused as-is for Student/Pro/Enterprise quota rows.
- **PRESERVE** — Founding Pro (`founding_pro_members`, `founding_pro_enroll_member_core`) — entirely orthogonal to this reconciliation; Founding Pro already inherits `pro_intelligence` and will inherit any future Pro capability the same way, by construction.

---

## 16. Required Refactors

Only one genuine architectural pressure point was found, and it does not block Data Intelligence work — it's worth naming so it isn't rediscovered later as a surprise:

- **Existing component**: `document_chunks`/`embeddings` shared table, used for spreadsheet markdown-table chunks.
- **Problem**: the generic `paragraphChunker` has no row/column awareness, so a chunk of spreadsheet content can be cut mid-row for any sheet whose serialized table exceeds ~1200 characters.
- **Why it matters**: RAG-retrieved spreadsheet chunks can be genuinely misleading (a row split across two chunks reads as two different, wrong rows) — but this is a pre-existing narrative-RAG quality issue, not something Data Intelligence's new persisted-grid path depends on or is affected by.
- **Dependency**: none on Data Intelligence's new work.
- **Risk**: low-to-moderate — affects answer quality for RAG-style spreadsheet questions today, independent of whether Data Intelligence ships.
- **Blocks Data Intelligence?** No.
- **Can be deferred?** Yes — 🟡 DEFERRED (§22).

No other refactor is architecturally necessary before Data Intelligence work can begin. The entitlement, capability, and workspace layers are correctly shaped as-is.

---

## 17. Security Architecture

**Current boundary** (verified, not proposed): every user-owned table follows one RLS shape — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`, or the workspace-role-extended variant (`auth.uid() = user_id or has_workspace_role(id, role)`) for workspace-shared tables. `runCapability`'s entitlement check is the server-authoritative Pro gate; client hooks (`useHasFeature`, `useHasProIntelligence`) are UX hints only, consistent throughout the codebase. Document/file ownership is `user_id`-scoped with an optional `workspace_id` secondary scope; RLS never trusts a client-supplied workspace_id — access is always re-derived from `auth.uid()`.

**Future rule for Data Intelligence**: a persisted structured-dataset representation must (a) be owned exactly like `documents` is today (`user_id`, optional `workspace_id`, same RLS shape — no new pattern needed), (b) have query execution happen server-side or under the same RLS-scoped read path documents already use — never trust a client-constructed query plan's row access without RLS re-enforcing it, and (c) have any new "run this analytical plan" RPC or capability follow the exact `runCapability`/`has_feature` gating pattern already proven for `workspace-briefing`. No new security primitive is anticipated; this is a data-modeling problem to solve within an already-correct security boundary.

---

## 18. Testing Architecture

Recommended structure, matching this repo's own established conventions (confirmed, not invented):

- **Unit** — plain `describe`/`it`, no mocking, for: schema/type inference (extends `columnAnalysis.test.ts`'s convention), analytical plan construction (pure function, input question-shape → plan object), deterministic calculation functions (extends `aggregates.ts`'s convention — reuse the `*.acceptance.test.ts` fixed-fixture pattern already established by `workbookAnalysis.acceptance.test.ts` against a pinned real-world-shaped dataset), validation logic, provenance formatting.
- **Integration** — mirror `AIService.test.ts`'s convention: `vi.hoisted()` mocks for every collaborator boundary (storage read, plan execution, provider call), asserting call sequencing/arguments rather than exercising real infrastructure. Three integration seams: uploaded workbook → persisted dataset representation; dataset → plan execution; execution result → LLM interpretation (each independently mockable at its boundary).
- **Entitlement** — extend the exact `runCapability.test.ts` pattern from P0 (real capability registration, mocked `hasFeature`, assert deny-before-any-AI-call): Free denied, Pro admitted, Founding Pro admitted (identically, no special-casing), and — **Student does not exist in the database today**, so any Student-tier test must be written against a *proposed* plan code, clearly labeled as such, not assumed present. Enterprise likewise: `enterprise` exists as a plan-code literal in some UI files already but has no dedicated capability today to test against.
- **Benchmark** — preserve the original Excel dataset and prompt set verbatim as the acceptance fixture (same convention `salesExpensesWorkbook.ts` already established) — do not replace it with a synthetic one; benchmark regressions must be measured against the same evidence that exposed the original gap.

---

## 19. Benchmark Framework

Baseline scoring (0–3) as specified, applied per benchmark question:
- **0 Failure** — incorrect, hallucinated, or unusable.
- **1 Partial** — correct reasoning direction, incomplete execution.
- **2 Correct** — correct calculation/reasoning, appropriate response.
- **3 Strong** — correct + insightful + limitations/implications stated.

Separate axis scores per question (0–3 each, independent of the composite score above): data access, calculation accuracy, analytical reasoning, evidence grounding, hallucination resistance, ambiguity handling, context retention, interpretation quality, academic/research reasoning (where applicable). Recording these separately is what lets a future regression be diagnosed precisely (e.g. "calculation accuracy regressed but hallucination resistance held") rather than only knowing the composite dropped.

---

## 20. Proposed Roadmap

The originally assumed order is **directionally correct but needs one adjustment validated by this audit**: Data Intelligence Foundation must be scoped tightly to "persist the full dataset + build the minimal deterministic query engine + LLM-as-planner/interpreter" *before* Analysis Intelligence, because Analysis Intelligence's entire value proposition (interpretation of verified evidence) is meaningless without a Verified Result to interpret — this was already the assumed order and the audit confirms it's necessary, not just convenient.

```
P0 — Pro Entitlement                          ✅
P1 — Advanced Workspace                       ✅
Architecture Reconciliation                   ✅ (this document)
Data Intelligence Foundation                  ← RECOMMENDED NEXT (see §24 for scope)
Analysis Intelligence
Research Intelligence
Critical Intelligence
Synthesis Intelligence
Planning Intelligence
Decision Intelligence
Professional Domain Intelligence
Enterprise Organizational Intelligence
```

One structural note not in the original sequence: **the Autonomy Model (§7 of the strategic brief / §5 of this report) is a genuine open design question that Data Intelligence's own scoping depends on** ("how many autonomous analytical steps can Student vs Pro run"). It doesn't need to be fully implemented before Data Intelligence starts, but it needs enough of a decision (even just "Data Intelligence v1 ships with autonomy fixed at one query per question, no multi-step chaining, for every tier" as an explicit scoping choice) to avoid Data Intelligence accidentally hardcoding an autonomy assumption that the real model later has to unwind.

---

## 21. Blocking Items

🔴 **BLOCKING** (must be addressed before Data Intelligence implementation):
- None found that require *code* changes. The one true precondition is a **decision**, not a build: confirm the Student plan code and its `plan_quotas` seed will exist (even as a proposed/not-yet-applied migration) before Data Intelligence's entitlement tests are written against it, so those tests aren't written against a fictional plan code.

---

## 22. Deferred Backlog

🟡 **DEFERRED** (important, does not block Data Intelligence):
- Row/column-unaware spreadsheet chunking (§16) — affects narrative RAG quality on large sheets, independent of the new deterministic-query path.
- General workspace-context injection into ordinary chat's system prompt (flagged already in the P1 report) — still deferred, still not required for Data Intelligence.
- Image Intelligence / Document Intelligence Pro-gating decision — currently free-tier-accessible; whether that's intentional product policy or an oversight needs an explicit decision at the tier-approval step, not a silent change here.
- Enterprise's actual governance/permission model (beyond "Enterprise is a plan") — needs its own design pass once Data Intelligence and the autonomy model exist, since Enterprise's organizational intelligence consumes both.
- Voice Intelligence architecture validation (confirmed buildable without a new isolated system per §19 of the brief, but not scoped in this audit beyond that confirmation).

🟢 **ENHANCEMENT** (future improvement, not part of this reconciliation):
- Google Drive import parity across platforms.
- Universal chat composer behavior.
- Advanced voice features (beyond baseline transcribe→understand→search).
- External research providers.
- Additional professional domain intelligence beyond the first one built.
- Advanced visualization (charting) of Data Intelligence results.
- Future database connectors (beyond uploaded spreadsheets).

---

## 23. Enhancements

(Consolidated with §22's 🟢 list above — no additional items beyond what's already captured there.)

---

## 24. Recommended Next Sprint

**Data Intelligence Foundation — smallest safe boundary:**

1. **Persist the complete structured dataset** in a queryable form for newly-processed spreadsheets (additive: existing markdown-chunk RAG path and existing summary-statistics path both stay exactly as they are; this is a third, parallel representation, not a replacement).
2. **Extend the existing Schema/Data Profile** (`columnAnalysis.ts`'s type/meaning detection) to describe the full persisted dataset, not just a display summary.
3. **Define the Analytical Query/Plan shape** (`{source, dimensions, measures, filters, aggregation, grouping, ordering, limit}` per §13 of the brief) as a TypeScript type — reuse `aggregates.ts`'s arithmetic as the execution primitives inside a new, genuinely parameterized deterministic executor.
4. **Build the LLM-as-planner/interpreter wiring**: a new capability (or capabilities) registered through the existing `registerPlatformModule`/`runCapability` pattern, `requiredFeature`-gated (reusing `feature:pro_intelligence`, or a new `feature:data_intelligence` key if the tier-approval step decides Data Intelligence should be independently gated from general Pro Intelligence — a decision for approval, not this audit).
5. **Validation + provenance**: minimum viable — does the plan reference real columns/types; result carries which rows/filters/sheet produced it, extending `resolveChunkProvenance`'s pattern.
6. **Deterministic tests against the preserved Excel benchmark fixture**, covering the §10 mapping table's 14 questions as acceptance cases.
7. **Explicitly out of scope for this sprint**: Analysis Intelligence (interpretation layer), Research/Planning/Decision, Student/Enterprise plan rows (unless the approval step decides otherwise), any UI beyond what's needed to exercise the new capability, Voice, Professional Domains.

This is the boundary that turns the Excel benchmark's core finding — "the complete dataset doesn't survive" — into the one thing this next sprint must fix, without expanding into any of the higher-order intelligence layers this audit explicitly did not implement.

---

## 25. STOP

Audit complete. No implementation performed in this phase beyond writing this report. Awaiting reconciliation/approval before Data Intelligence Foundation implementation begins.
