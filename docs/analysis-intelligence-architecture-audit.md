# ARRIYIA Analysis Intelligence Architecture Audit

Status: **AUDIT ONLY — no implementation in this phase.** Baseline: P0 (`2252034`), P1 (`8b7339c`), Reconciliation Audit (`5abeb34`), Data Intelligence Foundation (`8dbdf44`). This file is written but deliberately **not committed** per this phase's instructions — it exists on disk for review only.

---

## 1. Executive Conclusion

Data Intelligence Foundation built exactly what it needed to and nothing more: a persisted structured dataset, a small generic plan contract, a deterministic executor, and one AI capability that plans-then-interprets a single computation. It did not build — and explicitly should not have built — any of the machinery Analysis Intelligence now needs: multi-step orchestration, an observation/hypothesis vocabulary, comparative-reasoning helpers, contradiction detection, or a provenance chain wide enough to span several results.

The good news is that most of that machinery already exists elsewhere in the codebase, built for a different purpose (chat's deterministic `ReasoningPlan`, Knowledge Intelligence's sequential multi-capability chain, the confidence/evidence provenance chain, `ai_requests` observability). Analysis Intelligence's real job is architectural composition, not invention: reuse the deterministic-planner pattern for multi-step orchestration, reuse the sequential-capability-chain pattern for secondary analysis, reuse the evidence/provenance shape for the observation→conclusion chain, and reuse the single `feature:` entitlement mechanism for the autonomy boundary. The one genuinely new thing — contradiction/hypothesis distinction — is confirmed, by the codebase's own comments, to not exist anywhere yet; that is Analysis Intelligence's actual contribution.

The core discipline to preserve: **Data Intelligence computes, Analysis Intelligence interprets, and nothing downstream may silently upgrade an interpretation into a causal claim.** Everything below is designed around keeping that boundary a literal pipeline stage, not a convention someone can forget.

---

## 2. Current Data Intelligence Architecture

Verified by reading the code directly (not the prior audit's description of it):

```
question → AnalyticalPlan (LLM-proposed, code-composed prompt)
         → validatePlan (unknown_column / incompatible_type / ambiguous_measure / unsupported_aggregation)
         → executeAnalyticalPlan (pure, in-memory, filter→group→aggregate→sort→limit)
         → AnalyticalResult (ok: rows+provenance | error: typed reason)
         → formatAnalyticalResultForInterpretation (plain text)
         → runCapability('data-intelligence-query') → prose answer
```

One AI-registered capability (`data-intelligence-query`, `requiredFeature: 'data_intelligence'`). The planning step is *not* a registered capability — it's a direct `streamChatCompletion` call with a code-composed system prompt (`buildPlannerSystemPrompt.ts`), the same pattern `AIService`'s own chat system prompt already uses. `runDataIntelligenceQuery.ts` is the single orchestration function; it takes exactly one `datasetId` and one `question` and returns exactly one `DataIntelligenceQueryOutcome`.

## 3. What Data Intelligence Already Solves (verified, item by item)

1. **What `AnalyticalPlan` can express**: `filters[]` (eq/neq/gt/gte/lt/lte/in/between), `dimensions[]` (optional `dateTrunc: 'year'|'month'`), `measures[]` (`sum|avg|count|count_distinct|min|max|ratio`, each with its own optional `filters` for conditional counts, `ratio` with independent numerator/denominator terms), `sort`, `limit`. No cross-dataset joins, no derived/computed columns (a "Total Price" must already exist as a column — confirmed against the benchmark fixture, which pre-computes it rather than asking the engine to evaluate `Quantity × UnitPrice − Discount`), no period-over-period comparison primitive (handled today as a *post-processing* pass — `resultDerivatives.ts`'s `withPercentOfTotal`/`withSequentialGrowth` — operating on an already-executed result, never touching raw rows).
2. **What `AnalyticalResult` contains**: `status: 'ok'` → `{plan, rows: {dimensions, measures}[], provenance}`, or `status: 'error'` → `{plan, error: {code, message, column?}}`. One dataset, one plan, one result — no concept of "this result relative to that result" exists in the type.
3. **What provenance survives**: `{documentId, sheetName, sheetIndex, totalRowsInDataset, rowsMatchedAfterFilters}`. Traces to *which sheet of which document*, not to individual rows or cells, and not through to the original file (the file itself is never re-touched by this path — see §12).
4. **Validation**: structural only, against the dataset's real schema — column existence, type compatibility (numeric ops need numeric/currency columns, `dateTrunc` needs a date column), duplicate/missing measure names, unsupported aggregation values. No semantic validation (e.g. "is this a meaningful comparison" is out of scope by design — that's Analysis Intelligence's job).
5. **Errors represented**: exactly five typed codes (`missing_dataset`, `unknown_column`, `incompatible_type`, `ambiguous_measure`, `unsupported_aggregation`). An empty result set (0 matching rows) is explicitly **not** an error — it's a valid `status:'ok'` result with `rows: []` or one zero-valued group, and `formatAnalyticalResultForInterpretation` instructs the interpreter to say so plainly rather than treating it as a failure.
6. **How the LLM creates the plan**: one `streamChatCompletion` call, system prompt built from the dataset's schema description only (column names/types/meaning — never row values), user message is the raw question. The model is instructed to respond with only the plan JSON or `{"error": "..."}` if it can't build one.
7. **How the LLM interprets the result**: one `runCapability('data-intelligence-query')` call, prompt template explicitly says "do not recompute, re-derive, second-guess, or adjust any number... if the computed numbers alone cannot support a causal or interpretive conclusion, give the numbers and explicitly say what they do not establish." This sentence is the only place in the whole codebase today that gestures at the observation/causation boundary Analysis Intelligence must now formalize.
8. **How workspace context enters**: minimally. `runDataIntelligenceQuery` takes a bare `workspaceId: string | null`, threaded straight through to `streamChatCompletion`/`runCapability` for logging and RLS scoping. It does **not** call `buildWorkspaceHubState`, does not read objectives, does not use `CommandContext`. Compare P1's `generateWorkspaceBriefing`, which fetches the full Hub state before generating.
9. **Limitations** (confirmed, not assumed): one plan per question, no multi-step chaining, no comparison-of-results primitive, no hypothesis/observation vocabulary, no contradiction detection, no cross-dataset reasoning, no autonomy/step-budget field on the capability, no per-feature cost budget (only the blanket `ai_messages` monthly quota).
10. **Reusable APIs**: `getStructuredDataset`/`listStructuredDatasetsForDocument`, `executeAnalyticalPlan` (pure — critical, this is the function Analysis Intelligence must call *N times*, not reimplement), `buildDatasetSchemaDescription`, `formatAnalyticalResultForInterpretation` (or a close cousin of it), the `AnalyticalPlan`/`AnalyticalResult` types themselves (Analysis Intelligence's investigation is a *sequence* of these, not a replacement for them).

---

## 4. What Analysis Intelligence Must Add

Exactly four things the current architecture has no shape for at all:
1. A container for "more than one plan, in service of one question" — an **investigation**.
2. A vocabulary that keeps **observation** (a computed fact), **interpretation** (a reasonable reading of it), **hypothesis** (an untested explanation), and **causal claim** (a much stronger statement) visibly distinct in the data model, not just in prompt wording.
3. A mechanism for the *system* — not the LLM ad hoc — to decide "does this pattern warrant a follow-up analysis, and which one."
4. A way to say **"these two verified results appear inconsistent"** without inventing a resolution.

Everything else (execution, validation, provenance-per-step, entitlement) is Data Intelligence's job, called repeatedly.

---

## 5. Proposed Analysis Intelligence Abstraction

**Not `AnalysisPlan`.** An `AnalysisPlan` singular would just be `AnalyticalPlan` renamed, and the audit brief is explicit that the problem is investigating a question, not planning one calculation. **Not a heavyweight `AnalyticalInvestigation` with all the fields listed in the prompt's example (scope, objectives, dependency graph, uncertainty, synthesis, follow-ups) built up front.** That's over-engineering exactly what §5/§6 of the brief warns against — most of that state should be *derived* from a list of steps, not stored redundantly.

**Recommended minimal shape** — an `AnalysisInvestigation` that is fundamentally an ordered list of steps, each step wrapping one already-existing `AnalyticalResult` plus the reasoning layered on top of it:

```ts
interface AnalysisStep {
  id: string
  purpose: string                 // why this step exists ("baseline", "follow-up: by Product", ...)
  triggeredBy: string | null      // id of the prior step's observation that motivated this one; null for the first step
  plan: AnalyticalPlan            // reused verbatim from Data Intelligence
  result: AnalyticalResult        // reused verbatim from Data Intelligence
  observations: Observation[]     // see §9 — extracted from `result`, never invented
}

interface AnalysisInvestigation {
  id: string
  question: string
  datasetId: string
  steps: AnalysisStep[]
  hypotheses: Hypothesis[]        // see §9
  contradictions: Contradiction[] // see §10, usually empty
  synthesis: string | null        // final interpretation prose, null while in progress
  status: 'in_progress' | 'complete' | 'declined' | 'step_limit_reached'
}
```

This is deliberately **not** a dependency graph, not a tree, not a scored-priority-queue data structure — it's a flat, ordered list because every step observed in this codebase's own precedent (`runKnowledgeExtractionFromContent`'s three-stage chain) is sequential, not parallel-with-dependencies. If a genuine branching need appears later, `triggeredBy` already gives enough structure to reconstruct a tree without redesigning the type.

---

## 6. Investigation Lifecycle

```
Question
  ↓
Step 1: baseline AnalyticalPlan (LLM proposes, reusing buildPlannerSystemPrompt's exact pattern)
  ↓
executeAnalyticalPlan (Data Intelligence, unmodified)
  ↓
Extract Observation(s) from the result (deterministic — pull numbers straight out of AnalyticalResultRow, never re-derived by the LLM)
  ↓
Investigation Controller decides: stop, or propose a follow-up step (§11)
  ↓ (if follow-up)
Step 2: new AnalyticalPlan, informed by Step 1's observations (LLM call, sees prior observations as context — never prior raw rows)
  ↓
... repeat, bounded by a step budget (§14) ...
  ↓
Contradiction check across accumulated observations (§10)
  ↓
Synthesis (one final interpretation call, sees ALL observations/hypotheses/contradictions — the only call that produces prose)
```

This is structurally identical to `runKnowledgeExtractionFromContent`'s existing pattern — sequential steps, each step's output threaded into the next step's prompt variables, one provider pinned across the whole chain via `runWithFallback`'s existing chain-passing convention. The only genuinely new orchestration behavior is the *loop* (repeat until stop condition) and the *decision of what to do next*, both new to this codebase.

---

## 7. Multi-Step Analytical Reasoning Model

Two AI call sites, generalized from the one Data Intelligence has today:
- **Step planner** — proposes the next `AnalyticalPlan`, exactly like today's planner, but its prompt is additionally grounded in prior steps' `Observation[]` (never prior raw rows — the same "the LLM never sees the data, only the schema and computed results" discipline Data Intelligence already established must hold at every step, not just the first).
- **Step controller** — a small decision, not full prose: "given what's been observed so far, should we stop, and if not, what's the next question." This can plausibly be folded into the same call as the step planner (one call proposes both "here's an observation-informed follow-up plan" and "here's why"), avoiding a third AI call per step.

Deterministic execution stays identical per step: `executeAnalyticalPlan(dataset, plan)`, called once per step, never batched, never modified. This is the one piece of the whole design that must not change shape at all — every step is still "LLM proposes plan → engine executes → LLM never touches numbers."

---

## 8. Secondary-Analysis Mechanism

Concretely, for "why are returns high in the South":
1. Step 1 computes South's return rate (a `ratio` measure, exactly like the existing benchmark's row 2).
2. Observation extracted: `{type: 'metric', statement: 'South return rate: 26.1%', value: 0.261, stepId: 'step-1'}`.
3. Step controller compares this observation against a natural baseline — but critically, **the baseline computation itself is Data Intelligence's job, not Analysis Intelligence's**: "return rate by region" (no filter) is just another `AnalyticalPlan`, run as its own step, not a subtraction performed by the reasoning layer on numbers it wasn't given cleanly. Only the *comparison sentence* ("South is 4.4 points above the overall rate") is Analysis Intelligence's contribution — see §9 for exactly where that line is drawn.
4. Only after a genuine deviation is observed does the controller propose a follow-up dimension breakdown (Product, Store, CustomerType, ...) — never all of them speculatively (§11 covers prioritization).
5. Synthesis happens once, at the end, over the accumulated `Observation[]`/`Hypothesis[]`, never per-step.

This avoids "uncontrolled autonomous loop" by construction: the loop only ever proposes *one more Data Intelligence plan*, bounded by a hard step count (§14), and the loop's exit condition is either "no further deviation found" or "step budget exhausted" — never open-ended.

---

## 9. Observation / Interpretation / Hypothesis / Causal Distinction

This is the one piece of vocabulary that genuinely does not exist anywhere in the codebase today (confirmed — nothing in `knowledge-intelligence`, `data-intelligence`, or `intelligence/planner` distinguishes these). Proposed minimal types:

```ts
interface Observation {
  stepId: string
  statement: string          // e.g. "South return rate: 26.1% (39 of 150 orders)"
  value: number | null
  provenance: AnalyticalProvenance   // reused verbatim from Data Intelligence
}

interface Hypothesis {
  statement: string          // e.g. "Product mix may contribute to the elevated return rate"
  supportingObservationIds: string[]
  status: 'untested' | 'supported' | 'unsupported' | 'inconclusive'
}
```

**Deliberately no separate `Interpretation` or `CausalClaim` type.** Interpretation is prose generated at synthesis time, always required to cite the `Observation[]` it's grounded in (the same discipline the existing `data-intelligence-query` prompt already applies at single-result scale — "give the numbers and explicitly say what they do not establish"). A causal claim is not a data structure the system produces at all — it's a class of sentence the synthesis prompt is explicitly forbidden from writing without a hedge, enforced by prompt instruction, not by a type the model fills in (there is no reliable way to make an LLM self-classify "this sentence I'm about to write is causal" as a structured field with any more rigor than instructing it not to write the sentence). The escalation `observation → interpretation → hypothesis → causal claim` is a *discipline enforced in the synthesis prompt* layered on top of a data model that only ever stores the two things that can be verified: observations (numbers, provenance-backed) and hypotheses (explicitly labeled as untested).

---

## 10. Comparative Reasoning Architecture

**Split exactly along the existing Data/Analysis boundary — deterministic arithmetic in Data Intelligence, wording in Analysis Intelligence:**

| Operation | Layer | Why |
|---|---|---|
| Baseline value (e.g. overall return rate) | **Data Intelligence** | It's just another `AnalyticalPlan` with fewer/no filters — no new engine capability needed. |
| Percentage-point difference | **Data Intelligence** (a tiny new pure function, sibling to `resultDerivatives.ts`) | It's arithmetic over two already-computed numbers, not reasoning — same category as `withPercentOfTotal`/`withSequentialGrowth`, which already live outside the plan/execute contract precisely because they're derived views, not new aggregation primitives. |
| Relative percentage difference | **Data Intelligence** (same new module) | Same reasoning as above. |
| Ranking / concentration (e.g. "top 20% of stores drive 60% of returns") | **Data Intelligence** (already has `sort`+`limit`; a Gini/concentration helper is the same category as the percentage-point helper) | Deterministic, no interpretation involved. |
| Anomaly/deviation-from-baseline flagging (statistical threshold, e.g. "this is 2σ above the mean") | **Data Intelligence** — the *detection* (z-score, exactly like `aggregates.ts`'s existing `detectAnomalies` precedent from the pre-Data-Intelligence spreadsheet pipeline) | Precedent already exists (`detectAnomalies` in `src/modules/processing/spreadsheet/aggregates.ts`) as a deterministic z-score calculation — reuse the same math, don't reinvent. |
| "Is this deviation *meaningful*, and what might explain it" | **Analysis Intelligence** | This is exactly §12 of the reconciliation audit's own worked example: z-score anomaly *detection* is deterministic; *why it's anomalous and whether it matters* is Analysis. |
| Trend interpretation ("this looks like seasonal, not structural, change") | **Analysis Intelligence** | Requires judgment beyond arithmetic — the trend *values* come from `TrendAnalysis`/`withSequentialGrowth`, the *reading* of them is Analysis. |

The dividing line, stated once: **if it can be computed the same way regardless of the question's intent, it's Data Intelligence. If two different people could reasonably compute the same numbers and still disagree about what they mean, it's Analysis Intelligence.**

---

## 11. Contradiction Detection Architecture

**Confirmed absent everywhere in this codebase** — not partially built, not stubbed. The strongest evidence: `knowledgeConfidence.ts`'s own header comment names this exact gap verbatim ("Contradiction detection — would require an LLM comparing evidence passages pairwise for conflicting claims; no such capability exists yet") and it remains true after two full Knowledge Intelligence Layer sprints (v1, v2) that explicitly scoped it out both times as "a real, separate feature." Analysis Intelligence inherits this exact problem at the numeric-evidence layer instead of the text-evidence layer, and should solve it **the same way this codebase already solves the text-evidence version's adjacent problem (duplicate detection)**: deterministically where possible, narrowly scoped, never a general pairwise-LLM comparator.

**Recommendation: contradiction detection should be a combination, weighted heavily toward deterministic, exactly mirroring §10's split:**
- **Deterministic layer** (new, small): given two `Observation`s from the *same investigation* that both bear on the same metric/dimension, flag a structural inconsistency mechanically — e.g. "total sales rose (Observation A) while unit volume fell (Observation B)" is detectable by checking sign/direction of two already-computed trend results, not by asking an LLM to notice it. This is the *only* form of contradiction detection safe to build without an LLM: comparing two already-verified numbers' directions/magnitudes, never comparing prose.
- **Reasoning layer** (prompt discipline, not a new type): the synthesis step, given the full `Observation[]`/`Hypothesis[]` set, is instructed to say "these findings appear inconsistent; further investigation is required" rather than silently picking a narrative — this is a prompt-engineering discipline applied at synthesis time, the same category of guard the existing base chat prompt already applies ("answer using ONLY the context... if it doesn't contain the answer, say so"), extended to numeric evidence.

A `Contradiction` type, minimal:
```ts
interface Contradiction {
  observationIds: [string, string]
  description: string   // "Total sales rose 8% while unit volume fell 3%"
}
```
Detected mechanically for the "opposite-direction trend" case (the one case in the brief's own example list that's cleanly deterministic); everything else in the brief's list (narrative-vs-dataset conflict, subgroup-vs-aggregate divergence, trend-disappearing-after-segmentation) is a *pattern the synthesis prompt should be instructed to watch for*, not something a deterministic function can reliably flag from two numbers alone — those require the LLM to actually read the accumulated observations as a set, which is exactly what synthesis already does.

---

## 12. Follow-Up Analysis Prioritization

**Do not build a scoring engine** (explicitly out of scope per the brief). The architecturally sound placement: prioritization is a **judgment the step-planner LLM call already makes implicitly** every time it's asked "given this observation, what's the most useful next question" — the same way `buildReasoningPlan`'s `PLANNING_RULES` table encodes a fixed, deterministic *policy* for one decision (which context sources matter for this intent) without needing a numeric scoring function. Analysis Intelligence's investigation controller should follow the same shape: a **short, hard-coded priority ordering the prompt is told to prefer**, not a scoring formula computed in code.

Concretely, the step-planner prompt should state the factors from the brief in priority order as *instructions*, not weights: prefer a follow-up dimension that (1) is actually present in the dataset schema (relevance/availability — checkable deterministically before even asking the LLM, by cross-referencing `ColumnAnalysis[]`), (2) hasn't already been investigated this session (redundancy — checkable deterministically from `steps[].plan.dimensions`), (3) plausibly explains the magnitude of the deviation observed, not just its existence. Effect-magnitude and computational-cost concerns are naturally bounded by the step budget (§14) rather than needing their own scoring pass. This keeps prioritization as a *prompt-engineering + cheap deterministic pre-filter* problem, never a new statistical subsystem — consistent with "do not implement a scoring engine yet."

---

## 13. Provenance Model

Current chain stops at "sheet of document." The brief's target chain is:

```
Final conclusion → interpretation → analytical result(s) → analytical plan(s) → dataset → source document → original data
```

**Extend, don't duplicate.** `AnalyticalProvenance` already carries `{documentId, sheetName, sheetIndex, totalRowsInDataset, rowsMatchedAfterFilters}` per result — that's the bottom four links of the chain, already correct and already reused per-step under the proposed `AnalysisStep.result.provenance`. The two new links needed are entirely additive:
- **Result → Observation**: `Observation.provenance` is just a copy of (or reference to) the `AnalyticalProvenance` its source step already produced — no new provenance mechanism, just a pointer.
- **Observation → Synthesis**: the final synthesis prose should be required (by prompt instruction, mirroring `SourceReference`'s existing "always cite what you're grounded in" convention used throughout Knowledge Intelligence) to be traceable back to specific `Observation.id`s — this can be enforced the same way `getKnowledgeNodeEvidence` already enforces "evidence has a source, never fabricated": by construction, since the synthesis prompt is given only the accumulated `Observation[]`/`Hypothesis[]` list, never free access to raw data, the same discipline that already prevents the interpretation step from inventing numbers today.

No new provenance table, no new provenance component — `SourceReference`'s pattern (chip → source type → route) is directly reusable once an `AnalysisInvestigation` has a stable id and a `/analysis/:id` (or similar) drill-down surface, should one ever be built.

---

## 14. Autonomy Model

**Confirmed zero implementation exists** (full-repo grep for `autonomyEnvelope|maxSteps|maxDepth|step_budget|execution_budget` returns nothing). The reconciliation audit's own §5 already named the correct home for this and it remains correct after inspecting the actual planner code: `buildReasoningPlan`/`src/modules/intelligence/planner/` is a proven, fully deterministic, zero-AI-call module that already resolves per-turn behavior from a fixed lookup table (`PLANNING_RULES`). Extending that same pattern — not inventing a parallel one — is the right shape for autonomy resolution:

- **Do not add fields to `AICapability` yet.** The audit's own illustrative `autonomyEnvelope?: {maxSteps, allowedTools, requiresConfirmation}` remains illustrative, not a recommendation to implement now.
- **Do not create a second entitlement system.** Autonomy bounds should be resolved the same way tier gating already is — a `feature:` key (e.g. `feature:analysis_intelligence`, mirroring `feature:data_intelligence`'s precedent from this same phase) gates *whether* the capability runs at all; a *separate*, small, hardcoded-per-tier constant (not a database row, not a new quota key — a plain code constant like `MAX_INVESTIGATION_STEPS_BY_TIER`) governs *how many steps*, resolved at the orchestration layer, not inside `runCapability`. This mirrors `PLANNING_RULES`'s own shape: a fixed table, not a database-driven policy engine, because there is exactly one axis (tier) driving exactly one number (step budget) today — a full policy engine would be solving a problem that doesn't exist yet.
- Student/Pro/Enterprise differ only in the step-budget constant and (later) which follow-up dimensions are auto-explored vs. require a user click — never in which engine runs. `executeAnalyticalPlan` and the investigation loop's *code* is identical across every tier; only the loop's exit condition differs.

---

## 15. Security Model

**Inherits Data Intelligence's boundary unchanged — confirmed sufficient, nothing new required.** Every step in an investigation calls `getStructuredDataset(datasetId)` (RLS-scoped) and `executeAnalyticalPlan` (pure, no network) exactly as today; there is no new code path that could leak cross-user access, because there is no new *data access* primitive at all — an investigation is just N calls to the same one already-audited read path. The one new thing to verify explicitly when this is built: the *entitlement check* (`hasFeature`) must happen once, before the investigation starts, exactly like `runDataIntelligenceQuery`'s existing explicit `hasFeature` check before its first AI call — not per-step (redundant) and not only inside `runCapability` (too late, since the step-planner call is a direct `streamChatCompletion`, same pattern as today's single-plan flow). No SECURITY DEFINER function is anticipated; no RLS change is anticipated; `structured_datasets_security_test.sql`'s existing coverage (cross-user select/insert/update/delete denial, dataset-id-guessing denial, anon denial, cascade-delete) remains the complete security test surface for the underlying data access — Analysis Intelligence adds no new attack surface to test beyond "does the step budget actually stop," which is a correctness test, not a security test.

---

## 16. Performance/Cost Controls

**Confirmed gap, real and not previously flagged**: `ai_requests` already logs everything needed to *observe* cost (tokens in/out, latency, provider, per-`feature` tag) but there is **no enforcement mechanism beyond the single blanket `ai_messages` monthly quota** — no per-feature budget, no per-request cost ceiling, no rate limiting. An unbounded investigation loop is a real new risk this phase introduces that didn't exist when every AI-gated capability was one call.

Recommended controls, in order of what actually needs to exist before shipping vs. what can wait:
- **Hard step-count ceiling** (§14's tier constant) — must exist before any multi-step loop ships; this alone bounds worst-case AI calls to a small constant multiple of today's single-call cost.
- **Per-investigation timeout** — a simple wall-clock cutoff around the whole loop (not per-step), consistent with `streamAiChat`'s existing idle-timeout precedent (Phase 7D) rather than a new timeout mechanism.
- **Dataset size limit** — `executeAnalyticalPlan` is already O(rows) per step and already runs client-side/edge-side in memory; a hard row-count ceiling on which datasets are eligible for *multi-step* investigation (vs. single-plan Data Intelligence queries, which have no such limit today) is a cheap, obviously-necessary guard once the same dataset might be scanned N times in one investigation instead of once.
- **Redundant-step suppression** — free, already covered by §12's deterministic pre-filter (don't re-propose a dimension already investigated this session).
- **Per-feature token/cost budget** — genuinely new infrastructure (no `quotaKey` beyond `ai_messages` exists today); recommend deferring until real usage data justifies it, consistent with "do not implement limits now unless something already exists that should be reused" — nothing does yet, so this is Backlog, not Foundation-phase.
- **Failed-plan retry ceiling** — one step's plan failing validation should not silently retry unboundedly; cap retries per step (e.g. one re-prompt) and count a repeated failure as a stop condition, not an infinite loop.

---

## 17. Workspace Integration

Data Intelligence today barely touches workspace context (`workspaceId` passed through for RLS/logging only, no Hub state fetched). Analysis Intelligence should stay exactly that thin for the same reason: an investigation is about *one dataset*, not the workspace's aggregate state — pulling in `buildWorkspaceHubState` would blur Data/Analysis Intelligence's boundary with Workspace Intelligence's (P1) for no benefit. The one legitimate touch point: if/when an investigation's synthesis is worth persisting (mirroring P1's "Save as Note" pattern for Workspace Briefing), that persistence should reuse `createNote`/`linkKnownConceptsToSource` exactly as `generateWorkspaceBriefing` already does — not a new persistence mechanism. Not required for the Foundation phase of Analysis Intelligence; flagged as a natural, low-risk follow-up.

---

## 18. Multimodal Compatibility

The proposed `AnalysisStep`/`Observation` shapes are already source-agnostic in the one place that matters: `Observation.provenance` is typed as `AnalyticalProvenance` today, but nothing in the *investigation* or *synthesis* logic actually requires the evidence to have come from `executeAnalyticalPlan` specifically — an `Observation` is just `{statement, value, provenance}`. The architecture does not need to "support" images/voice/notes now, and shouldn't build toward it yet, but should avoid one specific trap: **do not hardcode `AnalyticalProvenance`'s shape into `Observation` itself** — reference it by a loosely-typed `provenance: unknown` cast at the boundary (the exact convention `extraction_metadata.metadata`/`getSpreadsheetAnalysis` already establishes for jsonb fields) so a future `Observation` sourced from Document Intelligence's structured extraction or an eventual Voice transcript can populate the same field with its own provenance shape without an `Observation` type migration. This is the only concrete "don't unnecessarily prevent it" adjustment worth making now; everything else (actually reasoning across evidence types) is genuinely future work, correctly out of scope.

---

## 19. Research Intelligence Dependency

Per the reconciliation audit's own §13 (already correct, reaffirmed here): Research Intelligence consumes Analysis Intelligence's **output**, never raw data. Precisely, once built, Analysis Intelligence should provide Research Intelligence:
- `AnalysisInvestigation.steps[].observations` (verified facts, provenance-backed)
- `AnalysisInvestigation.hypotheses` (explicitly labeled untested/supported/unsupported)
- `AnalysisInvestigation.contradictions` (flagged inconsistencies, never silently resolved)
- `AnalysisInvestigation.synthesis` (the interpreted narrative, with its own limitations stated)

Research adds literature, external evidence, methodology, and academic framing *on top of* this — it should never re-derive an observation Analysis Intelligence already verified, and it should never be handed raw `structured_datasets` rows directly (that would recreate exactly the "LLM receives partial data and guesses" failure mode Data Intelligence was built to eliminate, one layer up).

---

## 20. Planning Intelligence Dependency

Planning Intelligence needs "what should be done," which requires knowing both what's verified (Analysis Intelligence's `observations`) and what's uncertain (`hypotheses`, `contradictions`) — a plan that ignores stated uncertainty is exactly the overclaiming this whole architecture exists to prevent. Concretely: Planning Intelligence should consume the same four fields Research Intelligence does, plus `synthesis`, and should be structurally forbidden (by the same "cite what you're grounded in" discipline) from proposing an action premised on an `unsupported` hypothesis without flagging it as speculative.

## 21. Decision Intelligence Dependency

Same shape as Planning, one layer further: Decision Intelligence needs Planning's *options* plus Analysis's *evidence strength* per option (was the underlying observation strong, or was it flagged as a contradiction/low-confidence hypothesis). No new field required on `AnalysisInvestigation` for this — `Hypothesis.status` and the presence/absence of `Contradiction`s covering the same ground already carry the signal Decision Intelligence needs; it consumes, it doesn't require Analysis Intelligence to pre-digest a decision-specific summary.

---

## 22. Student / Pro / Enterprise Implications

Confirmed via §14: the engine (`executeAnalyticalPlan`, the investigation loop's code) is identical across every tier by construction — only the step-budget constant and the entitlement gate differ. Concretely:
- **Student**: `feature:analysis_intelligence` (or reuse a broader existing key if product decides Analysis should ship inside `pro_intelligence`/`data_intelligence` rather than its own — a tier-policy decision, not an architecture one) with a low step-budget constant (e.g. 1-2 follow-up steps, "guided" — perhaps requiring the user to click "investigate further" between steps rather than auto-chaining).
- **Pro**: higher step-budget, auto-chaining without per-step confirmation ("advanced analytical autonomy" per the brief).
- **Enterprise**: same engine, workspace-wide scope eventually (multiple datasets/documents per investigation) — this is the one place a genuinely new capability might be needed later (cross-dataset investigation), explicitly not scoped now.

No second entitlement system at any tier — every gate is a `feature:` key resolved through the existing `has_feature` RPC, exactly like `data_intelligence` and `pro_intelligence` already are.

---

## 23. Benchmark Evolution

**Preserve the Product Sales benchmark exactly as-is** (unmodified fixture, unmodified 12 acceptance tests) — it remains the correct test of "can ARRIYIA calculate the answer," which Analysis Intelligence still depends on being right.

**Proposed new benchmark layer**, same dataset, new question shape and new scoring axes:

| # | Question | Expected investigation behavior |
|---|---|---|
| 1 | "Why are returns high in the South?" | Baseline rate → regional comparison → ≥1 dimensional breakdown (Product/Store/CustomerType) → explicit hypothesis, not asserted causation |
| 2 | "What's driving the sales growth in 2024?" | Annual comparison (already-benchmarked) → breakdown by a plausible driver dimension → magnitude-of-contribution reasoning, not just "sales went up" |
| 3 | "Is there a relationship between promotions and returns?" | Compute both metrics independently → state correlation-is-not-causation explicitly (this is audit §13's Row 13, the deliberately-excluded-from-Data-Intelligence case — now the correct home for it) |
| 4 | "Compare Retail and Wholesale performance" (already benchmarked as one plan) | Extended: does the investigation *stop* correctly at one comparison rather than manufacturing an unwarranted follow-up? (tests over-investigation, not under-investigation) |
| 5 | A deliberately unanswerable "why" question (no plausible dimension in the schema explains it) | System states plainly that the data doesn't support a conclusion, rather than forcing a hypothesis (epistemic case C) |

Scoring (0-3, existing framework preserved) plus the **new axes the brief asks for**: evidence-grounding-per-observation (does every number in the synthesis trace to a specific step?), hypothesis-labeling discipline (is every non-computed claim explicitly marked as such?), stopping-behavior (does it stop when it should, not just start when it should), contradiction-honesty (does it flag inconsistency rather than paper over it), step-efficiency (did it take a reasonable number of steps, not the maximum every time). **Do not build this benchmark yet** — recorded here as the design for the phase that implements Analysis Intelligence to build against.

---

## 24. Existing Infrastructure to Reuse (REUSE)

- `executeAnalyticalPlan`, `AnalyticalPlan`/`AnalyticalResult` types, `getStructuredDataset` — called repeatedly, unmodified.
- `buildDatasetSchemaDescription`, `buildPlannerSystemPrompt`'s code-composed-prompt pattern — same shape, reused per step.
- `runCapability`/`streamChatCompletion`/`runWithFallback` — the AI execution stack, unmodified.
- `has_feature`/`hasFeature`/`plan_quotas` `feature:` namespace — the entitlement mechanism, one new key.
- `registerPlatformModule` — Analysis Intelligence registers through the same registry, no new registry.
- The sequential-chain-with-threaded-variables pattern from `runKnowledgeExtractionFromContent` — the concrete precedent for "multiple AI calls, each step's output feeding the next, one pinned provider across the chain."
- `resultDerivatives.ts`'s "generic post-processing over an already-executed result, never touching raw rows" convention — the exact pattern comparative-reasoning helpers (§10) should follow.
- `SourceReference`/evidence-chain shape from Knowledge Intelligence — the provenance-chip pattern, if/when investigations get a drill-down UI.
- `ai_requests`/`logAiRequest` — cost observability, unmodified, just more calls tagged with new `feature` values (e.g. `'analysis-investigation-step'`).
- `detectAnomalies` (z-score) from the pre-Data-Intelligence `aggregates.ts` — reusable arithmetic for the deviation-detection piece of comparative reasoning.

## 25. New Infrastructure Required (NEW)

- `AnalysisInvestigation`/`AnalysisStep`/`Observation`/`Hypothesis`/`Contradiction` types (§5, §9, §11) — small, additive, no schema/migration required to *design* them (persistence is a separate, deferred decision — see Backlog).
- The investigation-loop orchestration function itself (the multi-step analog of `runDataIntelligenceQuery`) — new code, reusing everything in §24.
- A small deterministic comparative-arithmetic module (percentage-point difference, relative difference, concentration/ranking helpers) — sibling to `resultDerivatives.ts`, genuinely new but genuinely tiny.
- Deterministic "opposite-direction trend" contradiction check (§11) — new, narrow.
- A tier-to-step-budget constant table (§14) — new, trivial.
- One new `feature:` entitlement key (`feature:analysis_intelligence` or similar — a naming decision for the approval step, mirroring `feature:data_intelligence`'s precedent).
- New prompt templates: step-planner (extends `buildPlannerSystemPrompt`'s shape with prior-observations context), synthesis (the one call that produces final prose, grounded in the full observation/hypothesis/contradiction set).

## 26. Infrastructure That Should NOT Be Duplicated (DEFER / DO NOT BUILD)

- A second entitlement system — use `feature:` keys.
- A second provenance system — extend `AnalyticalProvenance`, don't invent a parallel evidence-chain shape (Knowledge Intelligence's `knowledge_node_sources` is a *different* provenance system for a *different* content type; don't merge them, don't duplicate their pattern wholesale either — reuse the *concept*, not the table).
- A second AI orchestration layer — every AI call in Analysis Intelligence goes through `runCapability`/`streamChatCompletion`, exactly like today.
- A general pairwise-LLM contradiction comparator — confirmed, twice now (KIL v1 and v2), as explicitly out of scope; Analysis Intelligence should not attempt what two prior sprints already declined to attempt for the same underlying reason (unbounded cost, unclear reliability).
- A scoring engine for follow-up prioritization (§12) — a hardcoded priority-instruction list in the prompt, not a formula.
- A dependency-graph/tree data structure for investigations — a flat ordered list with `triggeredBy` pointers is sufficient until proven otherwise.
- Persistence infrastructure for investigations as a first-class stored entity — not required to *design* the shape (§25), and building storage before the interaction pattern is validated would be premature; if/when investigations need to be revisited later (like a saved Note), reuse `createNote`'s existing pattern rather than a new table.

---

## 27. Risks

- **Cost runaway** if the step budget isn't enforced before the first multi-step capability ships — the single highest-priority guard in this whole audit (§16).
- **False confidence from a well-written but ungrounded synthesis** — the discipline in §9/§11 is entirely prompt-enforced, not type-enforced; a model that ignores instructions can still write an overclaiming sentence. Mitigate with the benchmark's evidence-grounding scoring axis (§23), not by pretending a type system can prevent bad prose.
- **Scope creep into Analysis territory disguised as Data Intelligence extensions** — e.g. someone later adding a "correlation" measure aggregation directly to `AnalyticalPlan` would quietly move interpretation into the deterministic layer; §10's stated line ("if two reasonable people could disagree about what it means, it's Analysis") is the guard.
- **Investigation-length benchmark drift** — a benchmark that rewards "more steps" over "correct stopping" would incentivize exactly the runaway behavior §16 tries to prevent; the proposed scoring (§23) explicitly includes a stopping-behavior axis for this reason.

---

## 28. Recommended Implementation Sequence

Adjusted from the prompt's example based on actual findings — the dependency order that matters is: types before orchestration, deterministic comparative math before the loop needs it, the loop before contradiction detection (nothing to contradict with only one step), contradiction detection before the benchmark (nothing to score otherwise), autonomy boundary threaded in from the start (not bolted on after, since it changes the loop's exit condition) rather than saved for the end as the prompt's example suggested:

1. **Analysis architecture foundation** — `AnalysisInvestigation`/`AnalysisStep`/`Observation`/`Hypothesis`/`Contradiction` types; the small deterministic comparative-arithmetic module (§10); one new `feature:` key.
2. **Single-follow-up investigation loop** — the smallest possible multi-step case (baseline → exactly one follow-up → synthesis), with the step budget enforced from the very first version, not added later.
3. **Evidence/provenance chain** — wire `Observation.provenance` end-to-end, confirm the interpretation/synthesis step is structurally grounded in it (§13).
4. **Generalize the loop** — lift the one-follow-up limit to the tier-driven step budget (§14/§22), add the deterministic follow-up pre-filter (§12).
5. **Contradiction detection** — the deterministic opposite-direction check (§11); prompt-level synthesis discipline for the rest.
6. **Benchmark** — build the Analysis Intelligence benchmark designed in §23 against the same Product Sales fixture.
7. **Student/Pro autonomy boundary** — tier-to-step-budget wiring, guided-vs-auto-chain UX distinction (Student requires per-step confirmation; this phase should stop short of building Student's actual plan/UI, per explicit scope boundary — just confirm the loop's step budget is externally parameterized so this wiring is a config change, not a code change, when Student ships).
8. **Research Intelligence readiness** — confirm the four consumable fields (§19) are stable and documented; no Research code.

---

## 29. Proposed Phase Boundaries

**This phase (Analysis Intelligence Foundation) should build**: items 1-6 above, stopping before Student/Enterprise wiring and before any UI beyond what's needed to exercise a multi-step investigation (mirroring Data Intelligence's own "minimum UI necessary" precedent). **This phase should explicitly not build**: Research/Planning/Decision Intelligence, Voice, Student/Enterprise plan rows, cross-dataset investigation (Enterprise's eventual differentiator), a persisted/revisitable investigation entity, per-feature cost budgets beyond the step-count ceiling.

---

## 30. Backlog Items

- Persisted, revisitable `AnalysisInvestigation` (Note-like), once the interaction pattern is validated.
- Per-feature token/cost budget enforcement (genuinely new `quotaKey` infrastructure — deferred per §16 until usage data justifies it).
- Cross-dataset investigation (Enterprise's likely differentiator — explicitly deferred).
- UI drill-down from a synthesis sentence back through its observation chain (reusing `SourceReference`'s pattern) — natural but not required for Foundation.
- Row 13-style correlation-as-Data-Intelligence-primitive question: confirmed this phase's benchmark design (§23, item 3) is the correct home for it — no code change needed until Analysis Intelligence itself ships.
- Voice/Image evidence sources feeding an investigation (§18) — architecture doesn't block it, nothing to build now.
- A genuine dependency-graph investigation model, if a real use case ever needs parallel (not sequential) follow-ups — explicitly not needed today.

---

## STOP

Audit complete. No implementation performed in this phase. Awaiting explicit approval and a separate implementation prompt before Analysis Intelligence Foundation work begins.
