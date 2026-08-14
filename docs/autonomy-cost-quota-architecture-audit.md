# Autonomy, Cost & Quota Architecture Audit

**Status:** Audit + design reconciliation only. No application code, schema, migration, entitlement, quota, or UI changes were made in this phase.
**Baseline:** `d8337e8` (Multimodal Evidence Integration), branch `main`, repository `dingbee/personal-intelligence-platform`.

## 1. Executive Summary

ARRIYIA's three execution-capable intelligence engines (Data, Analysis, Research) each enforce their own hard, code-level step ceiling and are each gated by a binary plan entitlement (`hasFeature`) — but **none of the three ever calls `quotaService.checkQuota`/`consumeQuota`**. The only place real usage metering exists is `AIService.sendMessage` (ordinary chat), scoped to a single `ai_messages` quota key. This means a Research Intelligence investigation — which the engine's own code comment documents can cost up to 15 real AI calls, and which this audit shows can reach **up to ~45** once provider-fallback retries are counted — consumes **zero** metered quota. A Pro user can run this repeatedly, all month, at zero quota cost, while a single chat message consumes one full `ai_messages` unit.

This is not a missing subsystem that needs to be invented. The `plan_quotas`/`quota_usage` schema, the `resolve_effective_quota_limit`/`consume_quota` RPCs, and the `has_feature` RPC already form one coherent, dual-purpose mechanism: `ai_messages` is metered (usage increments, checked against a limit), while `feature:data_intelligence`/`feature:analysis_intelligence`/`feature:research_intelligence`/`feature:pro_intelligence` are the exact same table/RPC family repurposed as binary entitlement flags (limit=1, usage never incremented). Closing the gap this audit identifies is additive: new `quota_key` rows plus new call sites in three files — not a redesign.

Per-call telemetry (`ai_requests`, populated by `streamChatCompletion`) already exists and is already granular by operation type via the `feature` column (`'data-intelligence-plan'`, `'analysis-investigation-step'`, `'research-evidence-interpretation'`, etc.) — this audit found a stronger telemetry foundation than the brief's own draft target architecture assumed. What's missing is an **operation-grouping id** (no `investigation_id`/`operation_id` column ties five `ai_requests` rows back to "one Research Investigation"), not the raw event log itself.

**Recommendation for §19 (what must happen before Planning): Option C** — build only the minimum execution-budget abstraction (a shared, per-operation quota key + a thin `checkOperationBudget`/`consumeOperationBudget` wrapper reusing the existing RPCs), not a full autonomy-policy engine. Planning Intelligence would be the fourth engine to inherit an unmetered, duplicated-ceiling pattern if this is deferred further.

## 2. Repository / Baseline Verification

| Check | Result |
|---|---|
| Remote | `origin` → `https://github.com/dingbee/personal-intelligence-platform` |
| Branch | `main` |
| HEAD | `d8337e8` — "ARRIYIA — Multimodal Evidence Integration: Research Intelligence consumes image evidence" |
| Working tree | clean at audit start |
| Prior milestones present in `git log` | `7ac15fe`, `a7d1d39`, `f551872`, `9fc73e8`, `9bab3e7`, `8dbdf44` all present |

## 3. Current Autonomy Architecture

**EXISTS.** ARRIYIA has no general-purpose agent loop, no tool-call mechanism an LLM can invoke arbitrarily, and no unbounded recursion anywhere in the codebase (grepped for `while`, unbounded `for`, and every `MAX_`-prefixed constant — see §4). Every multi-step process is a **fixed, code-driven `for` loop with a hard-coded upper bound**, where the model only ever proposes the next action (a search query, an analytical plan, a stop/decline decision); a deterministic function executes it and reports back. This pattern is identical across all three engines — confirmed by direct comparison of `runDataIntelligenceQuery.ts`, `runAnalysisInvestigation.ts`, and `runResearchInvestigation.ts`.

Chat (`AIService.sendMessage`, `src/modules/ai/orchestration/AIService.ts`) has even less autonomy than the intelligence engines: `buildReasoningPlan` (`src/modules/intelligence/planner/planner.ts`) is explicitly documented as performing "no AI work" — it is a deterministic intent-classifier + fixed rule table (`PLANNING_RULES`), used only to compute UI suggestions, never to drive execution. The one place chat can trigger a secondary, deterministic (non-AI) operation is `runWorkspaceAction` (`AIService.ts:137`, `src/modules/workspace-actions/registry.ts`) — a registered-command router matched against the literal user text, not something the model decides to invoke mid-generation.

## 4. Intelligence Engine Execution Map

Grep for `MAX_`, `maxSteps`, retry/loop/limit patterns across `src` found the following execution-relevant constants (irrelevant UI/validation constants filtered out):

| Constant | Value | File |
|---|---|---|
| `MAX_INVESTIGATION_STEPS` | 5 | `src/modules/analysis-intelligence/api/runAnalysisInvestigation.ts:29` |
| `MAX_RESEARCH_STEPS` | 4 | `src/modules/research-intelligence/api/runResearchInvestigation.ts:41` |
| `MAX_EVIDENCE_PER_STEP` | 6 | `src/modules/research-intelligence/gatherEvidence.ts:8` |
| `MAX_EMBEDDING_RETRIES` | 5 | `src/modules/processing/pipeline/processDocument.ts:17` (ingestion, not chat/investigation path) |
| `MAX_CHAIN_DEPTH` | 10 | `src/shared/provenance/resolveEvidenceChain.ts:21` (pure in-memory traversal safety cap, no AI calls) |
| Provider fallback chain length | up to 3 | `src/modules/core/modules/coreModule.ts:45-47` — `anthropic`/`openai`/`google` are `status:'available'`; `ollama`/`openrouter`/`azure-openai` are `status:'planned'`, never real fallback candidates today |

No timeout controls, no concurrency limits, and no per-request token-count limits were found anywhere in the AI call path (`streamChatCompletion.ts`, `runWithFallback.ts`, any `ChatProvider` implementation). This is a genuine gap — see §11.

## 5. Data Intelligence Call Analysis

`runDataIntelligenceQuery.ts` — exactly **2 AI calls per operation**: one direct `streamChatCompletion` (planning, `feature:'data-intelligence-plan'`), one `runCapability` call (interpretation, capability `data-intelligence-query`). `executeAnalyticalPlan` between them is deterministic, zero AI calls. Both AI calls are wrapped in `runWithFallback(chain, ...)`.

- **Deterministic steps:** 1 (`executeAnalyticalPlan`)
- **AI calls, no fallback:** 2
- **AI calls, worst-case fallback (chain length 3):** up to 6
- **Failure behavior:** a declined/invalid plan returns immediately (`status:'declined'|'invalid_plan'`), no partial retry loop; `executeAnalyticalPlan` failing is not observed in this function (it always returns a structured `AnalyticalResult`, `status:'error'` included) — the caller (Analysis Intelligence, when delegating) treats an error result as a dead end for that step only.
- **Quota consumption:** **MISSING.** `runDataIntelligenceQuery.ts` calls only `hasFeature(userId, DATA_INTELLIGENCE_FEATURE_KEY)` — no `quotaService` import anywhere in the file.

## 6. Analysis Intelligence Call Analysis

`runAnalysisInvestigation.ts` — up to `MAX_INVESTIGATION_STEPS` (5) planning calls (one `streamChatCompletion` per step, `feature:'analysis-investigation-step'`), each followed by a deterministic `executeAnalyticalPlan` + `extractObservations` (pure logic, no AI), plus exactly one final synthesis call (`runCapability`, capability `analysis-investigation-synthesis`) once the loop ends.

- **Deterministic steps:** up to 5 (one `executeAnalyticalPlan` per completed step)
- **AI calls, no fallback:** 5 (steps) + 1 (synthesis) = **6**
- **AI calls, worst-case fallback (chain length 3):** up to (5+1) × 3 = **18**
- **Failure behavior:** an `error` result on any step is fatal (`hadFatalFailure = true`, loop breaks) but still proceeds to attempt synthesis over whatever steps succeeded; a first-step decline/invalid response returns immediately without synthesis.
- **Quota consumption:** **MISSING.** Only `hasFeature(userId, ANALYSIS_INTELLIGENCE_FEATURE_KEY)` is checked; no `quotaService` reference anywhere in this file.
- **Is the ceiling actually enforced server-side?** No — `MAX_INVESTIGATION_STEPS` is a plain TypeScript `for` loop bound inside client-callable application code (this repository has no separate backend process; the "server" for this loop is whichever environment runs this function — currently the browser/edge context that also renders the UI). There is no database-level or edge-function-level re-check of step count; a modified/compromised client calling the same exported function with a manually-supplied `maxSteps` parameter could exceed 5 (the parameter is caller-overridable by design, per its own signature). This is a real, if currently low-severity (no financial/quota consequence to exceeding it besides more AI calls), gap — see §11.

## 7. Research Intelligence Call Analysis

`runResearchInvestigation.ts` — the deepest chain. Per step (up to `MAX_RESEARCH_STEPS` = 4): either an `evidence_gathering` step (1 planner call +, if evidence was found, 1 evidence-interpreter call = up to 2 AI calls) or, at most once per investigation (`datasetUsed` flag), a `dataset_investigation` step that delegates unmodified to `runAnalysisInvestigation` (itself up to 6 AI calls, per §6). One final synthesis call (`runCapability`, capability `research-synthesis`) always follows if at least one step succeeded.

The function's own doc comment (`runResearchInvestigation.ts:27-40`) already computes a worst-case bound: **4×2 + (5+1) + 1 = 15 AI calls**, explicitly documented as "a real, documented, enforced ceiling, not an unbounded loop." This audit confirms that arithmetic against the actual code.

- **Deterministic steps:** `gatherEvidence` (retrieval, not an AI call) per evidence-gathering step
- **AI calls, no fallback:** up to **15** (per the engine's own analysis, confirmed correct)
- **AI calls, worst-case fallback (chain length 3):** up to 15 × 3 = **45** — **this multiplier is not accounted for anywhere in the existing code comment or documentation.** This is the single largest concrete number this audit produces.
- **Failure behavior:** mirrors Analysis Intelligence's pattern — a first-step decline/invalid response returns immediately; a later fatal failure stops the step loop but still attempts synthesis over completed steps; `synthesisFailed:true` is a distinct, non-fatal outcome (parse failure), never fabricated content.
- **Quota consumption:** **MISSING.** Only `hasFeature(userId, RESEARCH_INTELLIGENCE_FEATURE_KEY)` is checked (`runResearchInvestigation.ts:81`); no `quotaService` reference anywhere in this file or in `gatherEvidence.ts`.

## 8. Model Selection / Fallback Analysis

`runWithFallback.ts` — a pure sequential try-in-order loop: for each candidate provider id in `chain`, call `run(candidateId)`; return on first success; throw the last error if every candidate fails. **No retry within one candidate** (a single failed attempt against `anthropic` does not retry `anthropic` again — it moves to the next chain entry). Confirmed by direct reading — there is no loop-within-a-candidate anywhere in this function.

- **Is fallback charged?** Every attempt — success or failure — that reaches `streamChatCompletion` is logged to `ai_requests` (`logAiRequest`, both the `try` success path and the `catch` error path at `streamChatCompletion.ts:59-72`). A failed attempt therefore produces a real, billed-by-the-provider API call and a real telemetry row, even though it contributes nothing to the user-visible result. **Failed calls are counted in `ai_requests` but not counted against any quota** (quota consumption is a separate, engine-specific call — see §5-7 — and only chat's `consumeQuota` calls exist at all).
- **Streaming failures:** `streamChatCompletion` accumulates the stream and only returns after the `for await` loop completes; a mid-stream provider error throws, is logged as `status:'error'`, and propagates to `runWithFallback`, which then tries the next candidate — this does trigger a full new generation from the next provider, not a resumption.
- **Can different operations select different models?** Yes, at the *provider* level (each call site passes its own `chain`/`providerId`), but not yet at a per-operation-class policy level — Data/Analysis/Research/Chat all draw from the same `useProviderChain`-resolved candidate list; there is no code path today that would, for example, force a "cheaper" model for high-step-count operations.
- **Should autonomy policy eventually control model selection?** Architecturally reasonable (a bounded Student operation could be restricted to a specific model class) but **not implementable today** without new capability metadata — see §9.

## 9. Current Quota Architecture

**EXISTS**, narrowly. `quotaService` (`src/shared/lib/quotaService.ts`) exposes exactly two methods:
- `checkQuota(userId, quotaKey)` — resolves `resolve_effective_quota_limit(user_id, quota_key)` RPC (a single authoritative `coalesce(personal override, plan default)` computation, per its own doc comment), then reads `quota_usage.usage_count` for the current calendar-month period.
- `consumeQuota(_userId, quotaKey)` — calls `consume_quota(p_quota_key)` RPC, a `SECURITY DEFINER` atomic upsert scoped by `auth.uid()` server-side (the `userId` parameter is accepted but ignored — the RPC never trusts a client-supplied id).

**Call sites, confirmed by exhaustive grep of `consumeQuota|checkQuota` across `src`:** exactly two files reference these methods — `AIService.ts` (both calls, quota key `'ai_messages'`, once on the Workspace-Action shortcut branch and once on the normal chat-completion branch) and `useAiMessageUsage.ts` (a read-only UI hook calling `checkQuota` for display). **No other file in the entire repository calls either method.**

## 10. Current Entitlement Architecture

**EXISTS**, and is architecturally elegant: `has_feature(user_id, feature_key)` (`supabase/migrations/0046_feature_entitlements_and_storage_quota.sql:72-83`) is defined as `coalesce(resolve_effective_quota_limit(user_id, 'feature:' || feature_key), 0) = 1` — **the exact same RPC `checkQuota` uses**, applied to a `'feature:*'`-prefixed quota key whose `usage_count` is simply never incremented (no `consumeQuota` call ever targets a `feature:*` key). `plan_quotas` rows for `feature:data_intelligence`/`feature:analysis_intelligence`/`feature:research_intelligence`/`feature:pro_intelligence` are seeded with `quota_limit = 1` (migrations `0056`, `0058`, `0059`, `0060`), making `has_feature` a pure entitlement gate riding on the metered-quota infrastructure by convention, not a separate mechanism.

`hasFeature` (`src/modules/plans/api/plans.ts`) is the client wrapper each engine calls before doing any work. `AICapability` (`src/modules/core/capabilities/types.ts`) carries exactly one entitlement-relevant field today: an optional `requiredFeature: string`, checked by `runCapability.ts` before resolving a prompt/provider. **The capability registry does not currently carry any autonomy-relevant metadata** (no `autonomyClass`, `maxExecutionDepth`, `allowedModelClass`, `operationBudget`, or `allowedEvidenceScope` field exists) — see §16/§17 for whether it should.

## 11. Actual Worst-Case AI Consumption

All figures below assume the 3-provider fallback chain (`anthropic`/`openai`/`google`) is fully exhausted on every call — the true worst case, not the typical case.

| Operation | Best case | Typical case (no fallback) | Worst case (full 3-way fallback) |
|---|---|---|---|
| Ordinary chat (one turn) | 1 AI call | 1 AI call | 3 AI calls |
| Data Intelligence (one query) | 2 AI calls | 2 AI calls | 6 AI calls |
| Analysis Intelligence (one investigation) | 1 AI call (declined on step 1) | 6 AI calls (5 steps + synthesis) | 18 AI calls |
| Research Intelligence (evidence-only, no dataset delegation) | 1 AI call (declined on step 1) | up to 9 AI calls (4 steps × 2 + synthesis) | up to 27 AI calls |
| Research Intelligence + dataset delegation | 1 AI call (declined) | up to 15 AI calls (engine's own documented figure) | up to 45 AI calls |

None of the Data/Analysis/Research rows above consume any `quota_usage` row. Only the "Ordinary chat" row consumes `ai_messages` — exactly 1 unit, regardless of whether that single chat turn's own internal retrieval fan-out (documents/notes/assets/knowledge-graph/memory/spreadsheet, per `AIService.ts`, confirmed in the Multimodal Evidence Abstraction Audit) was expensive to assemble.

## 12. Cost Exposure

**The critical gap, quantified directly (§6 of the brief):** a Pro user's plan grants a fixed monthly `ai_messages` limit and separately grants `feature:research_intelligence = 1` (a boolean "yes you may use Research"). Once granted, Research Intelligence has **no metered ceiling at all** beyond the engineering safety bound (`MAX_RESEARCH_STEPS`) — a user (or a script automating the UI/calling the exported function directly) could run the same 45-AI-call-worst-case Research investigation an arbitrary number of times per month at zero quota cost, while every ordinary chat message they send consumes real, limited `ai_messages` quota. This inverts the expected cost relationship: the *more expensive* operation is the *unmetered* one.

This is a real architectural debt item, not a hypothetical: the Post-P2 Architecture Reassessment (`f551872`) already flagged "unmetered AI consumption" as high-priority, and this audit's own call-count analysis (§11) confirms the actual multiplier is materially larger than the engines' own doc comments account for (fallback was never included in their published worst-case math).

## 13. Autonomy Duplication

`MAX_INVESTIGATION_STEPS` (Analysis, =5) and `MAX_RESEARCH_STEPS` (Research, =4) are **fully independent constants**, declared in two different files, with no shared definition, no shared type, and no runtime relationship beyond Research's own delegation path invoking Analysis's already-bounded loop as a nested call. Both constants' own doc comments explicitly acknowledge they are "not a quota-table value" and describe themselves as "the engineering safety boundary" pending a future tier-specific or centralized policy — i.e., **the code already anticipates this audit's question**.

**What should be centralized vs. engine-specific:**
- **Should remain engine-specific:** the *reasoning* for why a given step count is appropriate (Analysis's 5 reflects "how many distinct analytical angles are usually worth exploring"; Research's 4 reflects "how many evidence-gathering rounds before diminishing returns," compounded by the fact that one Research step can itself delegate to a full Analysis investigation). These are domain judgments, not infrastructure.
- **Should eventually be centralized:** the *mechanism* for expressing and enforcing a numeric ceiling — today it's a bare exported `const`, duplicated by hand in each new engine. A shared `AUTONOMY_DEFAULTS` (or capability-metadata-carried) budget that each engine's own `maxSteps` parameter defaults from would prevent a fourth engine (Planning) from re-inventing this pattern a third time, without forcing Analysis and Research to share the *same* numeric value.

## 14. Multimodal Cost Implications

Reusing findings already established and tested in the Multimodal Evidence Integration sprint (`d8337e8`), reclassified here by cost category:

| Operation | Category | AI call? |
|---|---|---|
| `retrieveContext`/`retrieveNoteContext`/`retrieveAssetContext` | Retrieval (embedding + vector search) | One embedding call per turn (shared across all three via `AIService.sendMessage`'s single `embeddingProvider.embed` call — already deduplicated) |
| `executeAnalyticalPlan` | Deterministic computation | No |
| `analyzeImage` (`src/modules/assets/intelligence/analyzeImage.ts`) | Potentially expensive AI operation (vision call) | Yes — but confirmed **explicit/on-demand only** ("Analyze with NOVA" UI action), never automatic on upload, never triggered by Research's own retrieval |
| Document extraction (`processDocument.ts`) | Deterministic (text extraction) + embedding | Embedding only, at ingestion time, not at query time |
| Structured-data analysis (`executeAnalyticalPlan`) | Deterministic | No |
| Future voice/video | N/A — **confirmed absent**, no code path exists (per the Multimodal Evidence Abstraction Audit, §8) | N/A |

**Does Research retrieving an existing analyzed image cause another image-analysis call?** **No, confirmed by direct reading of `retrieveAssetContext.ts`**: it reads `assets.metadata` (the already-computed `AssetAnalysis` from a prior explicit "Analyze" action) and skips any asset whose `metadata` is `null` (never fabricates content, never triggers analysis just-in-time). Research's new asset-evidence wiring (`gatherEvidence.ts`) inherits this contract unmodified — it cannot cause a new vision-model call.

## 15. Provenance Interaction

**Should provenance carry operation ID / capability / model / execution step / cost metadata? No — this should remain in a separate execution/telemetry layer.** The shared provenance types (`src/shared/provenance/types.ts`) model `Source → Evidence → Derivation`, a purely *epistemic* chain (what supports this claim, and what was derived from it) — this is orthogonal to *operational* metadata (which model produced it, how much it cost, which step index it was). `security.test.ts`'s own static guard already enforces that every provenance adapter is a pure mapping with zero Supabase calls; adding cost/model/operation-id fields would pressure that boundary (an adapter would need access to `ai_requests` data it currently never touches) without adding evidentiary value — a `DerivationReference.statement` doesn't become more trustworthy for knowing which model wrote it. This mirrors the Provenance Foundation's own explicit design choice not to model confidence in the shared type either (left to the consuming engine). **RECOMMENDED**: if operation-level telemetry linking becomes valuable, it should live in `ai_requests` (adding an `operation_id` column there — see §16) or a future `intelligence_operations` table, joined to provenance only at read time by the caller that already has both ids in scope, never inside `src/shared/provenance/` itself.

## 16. Telemetry Gap

**PARTIALLY EXISTS**, stronger than a from-scratch gap. `ai_requests` (`supabase/migrations/0006_ai_governance.sql`) already durably records, per real AI call: `user_id`, `workspace_id`, `feature` (a string discriminator already granular per operation-type — `'data-intelligence-plan'`, `'analysis-investigation-step'`, `'analysis-investigation-synthesis'`, `'research-investigation-step'`, `'research-evidence-interpretation'`, `'research-synthesis'`, `'chat'`, `'analyze-image'`, plus `requested_provider`/`fallback_reason` per `0044`-era migrations), `provider`, `model`, `tokens_input`, `tokens_output`, `latency_ms`, `status`, `error_message`, `created_at`. `aiHealthAggregation.ts` (`src/modules/ai/observability/aiHealthAggregation.ts`) already computes `computeCapabilityHealth`, `computeUsageOverview`, and provider/error/trend breakdowns from this table for the AI Health Dashboard — this is real, tested, shipped aggregation, not a stub.

**What is genuinely MISSING**:
- No `operation_id`/`investigation_id` column — a Research Investigation's 15 `ai_requests` rows cannot be queried as one group; they are individually correct but not linkable without cross-referencing timestamps by hand.
- No cost/estimated-dollar field anywhere (tokens are recorded; no price table or computed cost column exists).
- `ai_requests` telemetry is entirely decoupled from quota — a row is written regardless of whether the operation consumed any `quota_usage` unit, so telemetry cannot currently answer "how much *metered* usage did this cost" for Data/Analysis/Research, only "how many raw calls happened."

## 17. Database Readiness

`plan_quotas.quota_key` and `quota_usage.quota_key` are both plain `text` columns (`supabase/migrations/0044_commercial_schema_reconciliation.sql:74-83, 131-142`) — **not an enum, not a fixed set**. This is the single most important structural finding for future work: **adding a new metered operation type requires zero schema change.** A new key such as `research_investigations` or `analysis_investigation_steps` (or a single shared `intelligence_operations` key) is addable via `insert into plan_quotas (...)` exactly as `0058`/`0059`/`0060` already did for the `feature:*` entitlement keys — the same table, the same unique constraint (`plan_id, quota_key`), the same `resolve_effective_quota_limit`/`consume_quota` RPCs, already proven correct for `ai_messages`.

`ai_requests` similarly has headroom: adding an `operation_id uuid null` column (nullable, so existing rows and non-investigation calls are unaffected) would be additive, not a redesign.

**Conclusion: EXISTS, sufficient for near-term operation-level accounting without a schema redesign.** The gap is entirely in application-layer call sites (§5-7), not in the database.

## 18. Security / Abuse Considerations

Confirmed, code-grounded, situations where a user could cause AI usage disproportionate to what any quota reflects:
- **Research → Analysis delegation** (§7): one user action can trigger up to 21 real AI calls (15 for Research's own steps/synthesis, up to 6 more for the nested Analysis investigation it delegates to) — all attributed to a single `ai_messages`-unrelated, unmetered path.
- **Provider fallback multiplication** (§8, §11): every one of those calls can itself multiply by up to 3× on transient provider failures — this is a genuine, currently *undocumented* multiplier on top of the engines' own published worst-case figures.
- **`maxSteps`/`documentId` parameters are caller-overridable**: `runResearchInvestigation`/`runAnalysisInvestigation` accept `maxSteps` as a function parameter with a default, not a value baked into the function body. Any code path that calls these functions directly (not through the UI, which never passes a higher value) could specify an arbitrarily large `maxSteps` — there is no server-side clamp independent of the caller-supplied value. This is a real, if currently unexploited (no such call site exists in the repo today), architectural gap: the "hard ceiling" is soft with respect to a determined caller of the exported function itself.
- **Large document/many retrieved chunks**: bounded — `retrieveContext`'s `SEMANTIC_MATCH_COUNT`/`MAX_LEXICAL_ONLY_ADDITIONS` and `gatherEvidence`'s `MAX_EVIDENCE_PER_STEP` cap how much text reaches any one prompt, but do not cap *how many times* that bounded retrieval can be paid for (i.e., re-running the same investigation repeatedly is not itself rate-limited beyond the entitlement gate, which is checked once per call, not once per time period).
- **Image analysis**: confirmed explicit-only (§14) — not currently exploitable for repeated-cost abuse beyond a user manually clicking "Analyze" repeatedly on the same image, each a real, individually-attributable `ai_requests` row.
- **Future voice/domain intelligence**: no code exists to assess; the risk is inherited by construction if a future engine copies today's `hasFeature`-only gating pattern without also adopting an operation budget.

## 19. Student / Pro / Enterprise Implications

The current architecture is **compatible in principle** with the proposed `Capability → Entitlement → Autonomy Policy → Operation Budget → Execution` layering (§16/§17 below), because the two lower layers (`Capability`, `Entitlement`) already exist and are already cleanly separated from execution (`hasFeature` is checked once, up front, in every engine's entry point — never re-derived mid-loop). The two missing layers (`Autonomy Policy`, `Operation Budget`) do not yet exist as first-class concepts; today, "autonomy" is implicitly hard-coded per engine as a single tier-agnostic constant (`MAX_INVESTIGATION_STEPS`, `MAX_RESEARCH_STEPS`), confirmed to have no tier parameter anywhere in either function's signature or call sites.

**Free** — unaffected by anything in this audit; out of scope, correctly.

**Student** — "smart academic intelligence with boundaries, not a crippled Pro" is achievable under the existing pattern by passing a smaller `maxSteps` value into the *same* `runAnalysisInvestigation`/`runResearchInvestigation` functions (both already accept `maxSteps` as an override parameter) — **no duplicated engine required**. The missing piece is *where that number comes from*: today it would have to be hard-coded per call site; the recommended target (§21) is for it to come from capability/entitlement metadata instead.

**Pro** — the current default behavior (`MAX_INVESTIGATION_STEPS=5`, `MAX_RESEARCH_STEPS=4`) already *is* what "deeper intelligence, broader capability" looks like relative to a hypothetical smaller Student budget — no change needed to Pro's own behavior for this to work, only for Student's to differ.

**Enterprise** — "organizational autonomy" (higher operation budgets, governance, auditability) is the tier most exposed by today's telemetry gap (§16): without an `operation_id` grouping and without organization-level usage rollups, there is no way to answer "how much did this workspace's Research usage cost this month" today, which an Enterprise governance story would need. This is a genuine dependency Enterprise work would inherit if built on the current telemetry shape unchanged.

## 20. Domain Intelligence Implications

Using the pattern already proven three times over in this codebase (Analysis reuses Data unmodified; Research reuses Analysis unmodified; the Provenance Foundation's adapters reuse each other recursively — confirmed across this session's prior three audits/sprints), the clear recommendation is: **future domain engines (Marketing, Finance, Sales, Operations, HR, Hospitality, Strategy) should be domain modules that orchestrate Data + Analysis + Research, not separate engines with their own step ceilings, their own quota keys, or their own entitlement checks.**

Concretely, a "Finance Intelligence" module would register its own capability (with its own `requiredFeature`, e.g. `feature:finance_intelligence`) and its own prompt templates, but its execution would call `runAnalysisInvestigation`/`runResearchInvestigation` directly (exactly as Research already calls Analysis) rather than reimplementing a plan/execute/observe loop. This is not a new architectural recommendation invented by this audit — it is the existing, already-validated pattern, restated for the domain-intelligence case specifically. The cost/autonomy implication: a domain module inherits whatever operation-budget mechanism Data/Analysis/Research eventually adopt, automatically, with zero domain-specific quota work — the strongest argument in this entire audit for building the shared operation-budget abstraction (§21 Option C) *before* any domain engine, since every domain engine built on top of an unmetered Research/Analysis pair inherits the same unmetered-cost exposure documented in §12.

## 21. Target Architecture

```
                    ARRIYIA Intelligence
                            |
                    Capability Registry           EXISTS (src/modules/core/capabilities)
                            |
                    Entitlement Resolver           EXISTS (hasFeature / has_feature RPC)
                            |
                    Autonomy Policy                MISSING — proposed below, minimal
                            |
              +-------------+-------------+
              |                           |
       Operation Budget             Execution Guards
       PARTIALLY EXISTS               PARTIALLY EXISTS
       (schema ready, §17;            (maxSteps ceilings exist per-engine,
        no call sites, §5-7)           §4/§13; no timeout/concurrency guard, §4)
              |                           |
              +-------------+-------------+
                            |
                    Intelligence Engine
                            |
             +--------------+--------------+
             |              |              |
           Data          Analysis       Research         EXISTS, all three
                            |
                      shared runtime      EXISTS (streamChatCompletion, runWithFallback,
                                            runCapability — already shared by all three)
                            |
                    Provenance/Evidence   EXISTS (a7d1d39, extended in d8337e8) —
                                           deliberately NOT extended with cost/operation
                                           metadata (§15)
                            |
                     Usage Telemetry      PARTIALLY EXISTS (ai_requests + aiHealthAggregation
                                           already real; operation_id grouping missing, §16)
```

This validates the brief's proposed diagram with one correction: "Autonomy Policy" and "Operation Budget"/"Execution Guards" are not equally missing — Execution Guards (the `maxSteps` ceilings) already exist per-engine; what's missing is (a) a place for Autonomy Policy to *decide* what those ceilings should be per tier, and (b) an Operation Budget that's actually metered (consumes quota), as opposed to merely bounded (won't loop forever, but costs nothing to run repeatedly).

## 22. Recommended Implementation Sequence

1. **Operation Budget (minimal, additive):** add one new `quota_key` per engine (or one shared `intelligence_operations` key, simpler) to `plan_quotas`; add one `quotaService.checkQuota`/`consumeQuota` call pair to each of `runDataIntelligenceQuery.ts`, `runAnalysisInvestigation.ts`, `runResearchInvestigation.ts`, mirroring exactly what `AIService.ts` already does for `ai_messages`. No schema redesign (§17), no new RPC, no new UI required for this step to close the cost-exposure gap (§12).
2. **Fallback-aware worst-case documentation:** update each engine's own doc comment to state the fallback-inclusive worst case (§11's table), so future readers don't under-estimate exposure the way the current comments do.
3. **Telemetry grouping:** add a nullable `operation_id` to `ai_requests`, generate one per investigation in each engine's orchestration function, pass it through every `streamChatCompletion`/`runCapability` call within that investigation. Additive, no existing row affected.
4. **Autonomy Policy (design, not full implementation):** extend `AICapability` with optional autonomy fields (`maxExecutionDepth`, `operationBudgetKey`) so a capability can *declare* its ceiling instead of each engine hard-coding it — evaluated in §9/§13, not yet built.
5. Only after 1-4: **Planning Intelligence**, now inheriting a metered, telemetry-linked pattern instead of becoming a fourth unmetered engine.

## 23. What Must Happen Before Planning

**Option C is recommended: build only the minimum execution-budget abstraction, then proceed to Planning.**

- **Option A (proceed directly to Planning)** — rejected. Planning would either (a) copy the existing unmetered `hasFeature`-only pattern, compounding §12's exposure a fourth time, likely with a *larger* worst-case call count than Research (since Planning would plausibly orchestrate across Data/Analysis/Research), or (b) require its own bespoke budget mechanism invented under time pressure, risking a fourth independent, duplicated ceiling (§13's concern, but worse).
- **Option B (build full shared autonomy/cost infrastructure first)** — rejected as over-scoped for what's actually needed next. A full `AutonomyPolicy` engine, generalized `ExecutionGuard` middleware, and tier-aware model routing are legitimate future work but are not blocking — steps 1-3 in §22 close the actual quantified risk (§12) without them.
- **Option C (minimum execution-budget abstraction, then Planning) — RECOMMENDED.** Steps 1-3 of §22 are small (three call-site edits, one migration, one column) and directly close the one concrete, quantified problem this audit found (§12). Step 4 (capability-carried autonomy metadata) is a design a future Planning-adjacent sprint can implement once Planning's own actual shape is known, rather than speculatively building policy metadata no engine yet consumes.
- **Option D** — no alternative architecture is justified by anything found in this repository.

## 24. Backlog

| Item | Reason | Dependency | Complexity | Blocks Planning? |
|---|---|---|---|---|
| Add operation-level quota consumption to Data/Analysis/Research (§22 step 1) | Closes the §12 cost-exposure gap directly | None — schema and RPCs already support it | Low | **Yes — recommended before Planning** |
| Fallback-aware worst-case doc comments (§22 step 2) | Existing comments understate real exposure by up to 3x | None | Trivial | No |
| `operation_id` telemetry grouping (§22 step 3) | Enables "cost of one investigation" queries; needed for Enterprise governance (§19) | None — additive column | Low-Medium | Recommended, not strictly blocking |
| Server-side clamp on caller-supplied `maxSteps` (§18) | A determined direct caller of the exported functions can exceed the documented ceiling | None | Low | No |
| Timeout/concurrency guards on `streamChatCompletion` (§4) | No timeout exists anywhere in the AI call path today | None | Medium | No |
| Capability-carried autonomy metadata (§22 step 4, §9) | Lets Student/Pro/Enterprise differ without duplicated engines | Depends on Student/Enterprise product decisions (explicitly deferred) | Medium | No — can follow Planning |
| Cost/price estimation on `ai_requests` | Tokens are recorded; no dollar figure anywhere | Requires a price table the brief explicitly said not to invent this sprint | Low-Medium | No |
| Centralized `AUTONOMY_DEFAULTS` mechanism (§13) | Prevents a 4th hand-duplicated `MAX_` constant | None | Low | No |

## 25. Final Recommendation

The autonomy architecture is sound: every execution loop is already bounded, deterministic-in-the-middle, and structurally identical across engines. The real, quantified problem is narrower than "no cost control exists" — it is "cost control exists for exactly one operation type (`ai_messages`) and was never extended to the three engines that were built on top of it," even though the same database mechanism that already meters `ai_messages` and gates `feature:*` entitlements can meter them too, additively, without a redesign. Close that gap (§22 steps 1-3) before Planning Intelligence, so Planning inherits a metered pattern rather than becoming the engine that makes the gap permanent.

---

**STOP.** This document is an audit and design-reconciliation only. No recommended architecture was implemented. Planning Intelligence, Decision Intelligence, Domain Intelligence, Student/Enterprise plans, quotas, and entitlements remain unmodified.
