# ARRIYIA — Post-P2 Intelligence Architecture Reassessment

**Status:** Audit only. No production code, migrations, entitlement logic, or tests were modified to produce this document.
**Repository:** `dingbee/personal-intelligence-platform`, branch `main`
**Audited at:** commit `9fc73e8` (Research Intelligence P2)
**Baseline commits referenced:** P0 `2252034` · P1 `8b7339c` · Reconciliation Audit `5abeb34` · Data Intelligence `8dbdf44` · Analysis Intelligence `9bab3e7` · Research Intelligence `9fc73e8`

---

## 1. Executive conclusion

The three-engine chain (Data → Analysis → Research) is real, works, and is architecturally sound: each engine reuses the one below it completely, unmodified, and none of the three ever lets an LLM compute a number or originate a source. That pattern is proven twice over (Analysis reusing Data, Research reusing Analysis) and should be the template for every future engine, including Domain Intelligence.

The platform is **not**, however, sitting on the unified "Intelligence Core → Capability Policy → Autonomy Policy → Student/Pro/Enterprise" substrate the target architecture in this brief describes. What exists today is eight independently-registered, single-or-few-capability modules, six structurally incompatible provenance shapes, three unrelated deterministic "planning"-adjacent subsystems that already use the words "Decision Intelligence" and "Learning Intelligence" for something much smaller than this brief means by those terms, and a per-engine step-budget constant repeated three times with no shared abstraction. None of this is broken — every engine audited works correctly and honestly — but none of it is yet *general* infrastructure a fourth or fifth engine could simply plug into.

The highest-leverage next investment is **not** Planning Intelligence. It is a **provenance foundation** and the **multimodal evidence abstraction** that depends on it. Without those, every future engine (Planning, Decision, Domain) will either invent its own seventh provenance shape or silently drop the "trace every claim to its source" discipline that makes Data/Analysis/Research trustworthy today. Section 20 gives the full recommended sequence and rationale.

## 2. Current architecture

The intended shape from the brief —

```
                 ARRIYIA INTELLIGENCE CORE
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   Intelligence        Capability         Autonomy
     Engines             Policy             Policy
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                 Student / Pro / Enterprise
```

— is **partially** present. What actually exists:

- **Capability Policy** is real and consistent: `registerPlatformModule()` (`src/modules/core/modules/registerPlatformModule.ts`) pushes each module's `capabilities`/`prompts`/`providers`/`workflows` into four flat registries; `runCapability()` (`src/modules/ai/orchestration/runCapability.ts`) is the single enforcement point that resolves a capability, checks `hasFeature(userId, capability.requiredFeature)`, resolves the active `PromptTemplate`, and calls `streamChatCompletion`. Every gated capability audited (Data/Analysis/Research Intelligence, `analyze-image`, document-intelligence, knowledge-intelligence's briefings) goes through this one path. There is no second entitlement system and no hardcoded plan-code branch anywhere in the capability layer.
- **Intelligence Engines**, in the sense this brief uses the term (bounded investigation → verified/observed result, provenance attached), number exactly **three**: Data, Analysis, Research. Nothing else in the codebase matches that shape yet (see §4 and §14 for why several similarly-named things do not qualify).
- **Autonomy Policy** does **not** exist as shared infrastructure. It exists three times, independently, as plain exported constants: `MAX_INVESTIGATION_STEPS = 5` (Analysis Intelligence) and `MAX_RESEARCH_STEPS = 4` (Research Intelligence), each with its own doc comment explaining the same reasoning (not quota-backed, tier-agnostic, a future tier budget is a parameter change). Data Intelligence has no step budget at all (it is single-shot). This is a real gap — see §9 and §16.
- **Student/Pro/Enterprise** does not exist as a resolved architecture. Only `free`, `pro`, `founding_pro` plan rows are confirmed live (from `plans`, referenced by every feature migration read for this audit); no `student` or `enterprise` plan code appears anywhere in `src/modules/plans/` or the migrations audited. See §11.

Eight modules currently call `registerPlatformModule()`: `data-intelligence`, `analysis-intelligence`, `research-intelligence`, `knowledge-intelligence`, `processing/documentIntelligence`, `workspace-intelligence`, `ai/artifacts`, and `core/modules/coreModule`. That count is coincidentally close to the historical "8 intelligence layers" folklore this brief warns against trusting — but the eight are not eight peers. `coreModule` and `artifacts` register platform mechanism, not intelligence; `workspace-intelligence` and `knowledge-intelligence` are hybrids of evidence store, light engine, and product experience; `documentIntelligence` is a cross-cutting evidence-preparation capability every ingested document already passes through, not a standalone reasoning engine. §4 gives the corrected classification.

## 3. P0/P1 status

**P0 — Pro Intelligence Foundation** (`2252034`, migration `0056_pro_intelligence_foundation.sql`): confirmed exactly as documented — one `plan_quotas` row per plan (`feature:pro_intelligence`, limit 1, seeded for `pro`/`founding_pro` only), resolved through the pre-existing `has_feature`/`resolve_effective_quota_limit` machinery, no new table/column/RPC. Its own migration comment explicitly anticipates "Research / Planning / Deep Academic Intelligence" gating on it later — none of the three built-since capabilities actually did (each took the dedicated-key path instead, see §3 continued and §8), which is a deliberate, documented, and in this audit's judgment correct divergence: `pro_intelligence` remains the coarse "is this a Pro account at all" flag, never overloaded as a per-capability gate.

**P1 — Advanced AI Workspace** (`8b7339c`): audited via the current shape of `src/modules/ai/` (orchestration, providers, chat, memory, embeddings, artifacts, observability). `AIService.sendMessage` (`src/modules/ai/orchestration/AIService.ts`) is the one chat entry point and already assembles, per turn, six independent context sources concurrently — documents (`retrieveContext`), images/assets (`retrieveAssetContext`), notes (`retrieveNoteContext`), named-entity and chunk-sourced knowledge-graph context, memory (`retrieveMemoryContext`), and document-scoped structured/spreadsheet context (`retrieveSpreadsheetContext`) — into one system prompt, with chunk-level provenance resolved before the prompt is built. This is real, working, already-shipped multimodal-into-one-substrate convergence for **conversational** answers. It is a materially different code path from the three typed Intelligence engines, though — see §7 for why that matters.

## 4. Data Intelligence status

Unchanged since `8dbdf44`; re-verified via `git status`/`git diff` for this audit — zero modifications from either Analysis or Research Intelligence. `executeAnalyticalPlan` remains the sole code that reads `structured_datasets` rows and produces a number; it has no AI dependency and no step budget (a single deterministic execution per call). `AnalyticalProvenance` (`documentId, sheetName, sheetIndex, totalRowsInDataset, rowsMatchedAfterFilters`) is the provenance unit both Analysis and Research now carry forward unmodified.

## 5. Analysis Intelligence status

Unchanged since `9bab3e7`. `AnalysisInvestigation` is a flat `AnalysisStep[]`, each step one `AnalyticalPlan`/`AnalyticalResult` pair plus deterministically-extracted `Observation[]`. `MAX_INVESTIGATION_STEPS = 5` is enforced in the loop itself, independent of any UI state. One registered capability (`analysis-investigation-synthesis`); per-step planning is a direct, unregistered `streamChatCompletion` call. This remains the cleanest example in the codebase of "LLM proposes, deterministic engine executes, LLM never touches the numbers."

## 6. Research Intelligence status

Unchanged since `9fc73e8`. Delegates to Analysis Intelligence wholesale (capped at once per research investigation) rather than reimplementing any dataset reasoning. Evidence gathering (`gatherEvidence.ts`) is 100% real, deterministic retrieval over the caller's own documents/notes — no fabricated source has ever been possible by construction, because a `ResearchSource` can only be built from an id `retrieveContext`/`retrieveNoteContext` actually returned. `MAX_RESEARCH_STEPS = 4`, independently enforced, with dataset delegation additionally capped at once. The architecture audit that preceded P2 correctly identified and then correctly worked around the absence of any web-source infrastructure (§15) rather than fabricating one.

## 7. Multimodal convergence

Two genuinely separate "evidence access" paths exist side by side today:

1. **Chat's automatic convergence** (§3/P1): broad, prose-grounded, six sources merged into one prompt per turn, entirely for the benefit of a conversational answer. Provenance here is ephemeral (`contextTrace`, logged via `console.debug`, never persisted) and per-turn.
2. **The three typed Intelligence engines' pipelines**: narrow, structured, provenance-carrying, invoked explicitly (Analysis Investigation, Research Investigation), never automatically triggered by ordinary chat.

These do not share a type or a substrate. A document chunk that grounds a chat answer and an `AnalyticalProvenance` row that grounds an Analysis observation are unrelated shapes with no common interface. **This is the concrete architectural gap the brief's "can text, image, voice and structured data ultimately become evidence available to the same reasoning substrate?" question is really asking about**, and the honest answer today is: partially, and only inside chat's own prompt-assembly step — not inside the typed engines, and not persistently.

**Recommended architecture (not implemented in this phase):** a minimal `EvidenceSource`/`EvidenceItem` interface general enough to represent a document chunk, an image analysis, a note, a dataset row, and (later) a voice transcript segment, each carrying a stable id, a type tag, and a provenance record from a *single* shared provenance vocabulary (see §10). Retrieval functions (`retrieveContext`, `retrieveAssetContext`, `retrieveNoteContext`, and future engines) would map their native results into this shape at the boundary, rather than each engine defining its own. `gatherEvidence.ts` (Research Intelligence) is the closest existing precedent for what this could look like generalized.

## 8. Voice architecture

**Confirmed absent, entirely — not partially scaffolded.** An exhaustive case-insensitive grep of the whole repository (`src/`, `supabase/`) for `transcri`, `whisper`, `speech-to-text`, `MediaRecorder`, `audio recording` returns zero real hits; every match for the bare word "voice" resolves to either brand/personality copy (`novaPersonality.ts`, "ARRIYIA's voice") or an unrelated substring (e.g. "invoice"). There is no audio upload path, no `assets` file-type entry for audio, no edge function touching an STT provider, and no database column anywhere shaped for a transcript.

Per the brief's own Pro/Enterprise boundary ("Pro = understand my voice. Enterprise = understand our organization's conversations."), the recommended architecture, to be designed in a future phase and not started here:

- Voice becomes a **new input type feeding the same evidence substrate** as text/image (§7) — a transcript segment is structurally just another `EvidenceItem`, with speaker/timestamp metadata as its provenance extension, not a parallel application.
- Recording → transcription is an ingestion concern, analogous to how document extraction (`src/modules/processing/`) already turns a file into `ExtractionResult` → chunks. A `VoiceIntelligence` module would own that ingestion, then hand transcript segments to the same retrieval/knowledge-graph/Research pipeline everything else already uses, rather than owning its own summarization/theme/action-item logic in isolation.
- The Kiswahili/English/code-switching requirement is a transcription-provider capability question (does the chosen STT vendor support it), not an architecture question — defer until a provider is chosen.
- Meeting-level features (speaker ID, recurring-meeting intelligence, organizational memory) are the Enterprise-tier extension of the same substrate — organizational permissions/governance gate *who* can query which transcripts, not a separate reasoning engine.

## 9. Image architecture

Treated as validated per the brief; the audit confirms it is real and already well-integrated, not merely UI decoration:

- **Entry point:** `analyzeImage.ts` makes a genuine vision-model call (`streamChatCompletion` with a `ChatContentPart[]` message carrying `{type:'image', imageUrl}`), never a registered capability (capabilities can't carry non-string variables). The prompt explicitly forbids speculation beyond what's visible and asks for a *self-reported* confidence estimate, framed as an estimate, "never a substitute for real calibrated confidence" — the code's own comment is explicit that no provider in this codebase exposes a calibrated confidence score.
- **Becomes evidence:** `buildAssetContextContent.ts` formats the stored `AssetAnalysis` (description, transcribed text, language, document-intelligence fields, low-confidence caveats) into the exact same flat evidence-block role a document chunk plays in the chat system prompt — already converged with text at the chat layer (§7's path 1).
- **Enters retrieval:** asset search (`indexAsset`/`assetSearchProvider`) makes analyzed images findable via Universal Search; the analysis also feeds the existing knowledge-extraction chain, so image-derived concepts/entities can land in `knowledge_nodes` with `knowledge_node_sources` pointing back at the asset (source_type `'asset'`).
- **Handwritten text stays distinguishable from AI interpretation:** the model's free-text *description* and its verbatim *TEXT:* transcription are separate fields, and a below-0.5 self-reported confidence surfaces as an explicit caveat sentence rather than being silently dropped or folded into the description — the distinction the brief asks about is preserved by construction, not by convention alone.
- **Cannot yet participate in Data/Analysis/Research Intelligence.** `ResearchSource.type` is `'document' | 'note' | 'dataset_investigation'` — no `'asset'` member exists, so an analyzed image can ground a chat answer or a knowledge-graph node today, but cannot become `ResearchEvidence` in a Research Investigation, nor can Data/Analysis Intelligence consume image-derived numbers (they only ever read `structured_datasets`, spreadsheet-only). This is a concrete, scoped convergence gap — see BACKLOG.

## 10. Provenance architecture

The audit's single most important structural finding. **Six distinct, structurally incompatible provenance/evidence shapes exist today**, none aware of the others:

| Shape | Defined in | Scope |
|---|---|---|
| `AnalyticalProvenance` | `data-intelligence/analyticalPlan.ts` | dataset/sheet/row-count facts behind one computed number |
| `Observation.provenance` | `analysis-intelligence/analysisInvestigation.ts` | reuses `AnalyticalProvenance` directly (the one genuine case of reuse) |
| `ResearchSource`/`ResearchEvidence` | `research-intelligence/researchInvestigation.ts` | internal-only source refs (document/note/dataset-investigation) + verbatim excerpt |
| `SourceReferenceItem`/`EvidenceItem` | `shared/components/knowledge/SourceReference.tsx`, `knowledge-intelligence/api/knowledgeNodeEvidence.ts` | internal-only refs (document/note/conversation/asset/knowledge_node) backing a knowledge-graph node |
| `source_chunk_ids` (+ ad hoc `contextTrace`) | `notes` table; `ai/orchestration/buildContextTrace.ts` | which chunks grounded a saved note / a chat turn (the latter ephemeral, logged not persisted) |
| `generation_metadata` (`artifactKind`/`creationMethod`/`artifactData`) | `ai/artifacts/artifactMetadata.ts` | *how* a Note was created, not *what evidence* supports its claims — a different axis entirely, easy to conflate with the others |

A future answer that must cite a document, an image, a voice transcript, a spreadsheet cell, a note, and a knowledge-graph node all in one response — exactly the scenario the brief's §14 worked example describes — **cannot currently do so through one mechanism**. Whichever engine tries first will either (a) invent a seventh shape, repeating the pattern, or (b) silently drop provenance for whichever source type its author didn't think to unify. Section →source→evidence→computation→observation→synthesis→conclusion→saved-knowledge survives *within* each of the three engines individually today; it does not survive *across* them, and does not survive into chat's ephemeral per-turn trace at all.

**Minimum change eventually required** (not implemented here): a single `EvidenceReference {sourceType, sourceId, excerpt?, retrievalContext?}` shape that `AnalyticalProvenance`, `ResearchSource`, and `SourceReferenceItem` all either become or trivially map to/from, plus persisting chat's `contextTrace` instead of discarding it. This is the prerequisite for §7's evidence abstraction and for any Domain/Planning/Decision engine that must cite multiple engines' outputs in one answer.

## 11. Student/Pro/Enterprise architecture

Only `free`, `pro`, `founding_pro` are live plan codes (confirmed by grep across `src/modules/plans/` and every feature-gating migration audited — `0046`, `0056`, `0058`, `0059`, `0060`). No `student` or `enterprise` plan row, feature key, or capability check exists anywhere in the code audited.

What the current architecture **can** already express cleanly, without any redesign:

- **Per-capability gating** — proven three times (`feature:data_intelligence`, `feature:analysis_intelligence`, `feature:research_intelligence`), each a one-migration, one-row-per-plan addition. Adding a `student` plan and selectively seeding some of these keys for it (and not others) requires zero code changes to the engines themselves — only new `plan_quotas` rows.
- **A capability being available to a lower tier with a smaller execution budget** — architecturally possible today (`maxSteps` is already an injectable parameter on both `runAnalysisInvestigation` and `runResearchInvestigation`) but **not yet wired to plan tier** — the parameter exists, nothing currently reads "what tier is this user" to choose its value. That wiring is the concrete, small piece of work Student's "guided autonomy" needs (see §9 autonomy).

**Recommended matrix** (recommendation only — no plan rows created in this phase):

| Capability | Free | Student | Pro | Enterprise |
|---|---|---|---|---|
| Ordinary chat + retrieval (P1) | ✅ | ✅ | ✅ | ✅ |
| Data Intelligence | — | ✅ (bounded) | ✅ | ✅ |
| Analysis Intelligence | — | ✅ (smaller step budget) | ✅ (full) | ✅ (full) |
| Research Intelligence | — | ✅ (smaller step budget, internal sources only) | ✅ (full) | ✅ + org sources |
| Domain Intelligence (future) | — | — | ✅ | ✅ |
| Planning Intelligence (future) | — | bounded | ✅ | ✅ + org workflows |
| Decision Intelligence (future) | — | — | ✅ | ✅ + governance |
| Voice Intelligence (future) | — | — | ✅ (personal) | ✅ (organizational, speaker ID) |
| Organizational governance/permissions (future) | — | — | — | ✅ |

The one open design question this audit surfaces but does not resolve: whether Student gets the *same* engines at a smaller step budget (this table's assumption, and the cheaper option — reuses everything, changes only `maxSteps`/`feature:*` seeding) or a deliberately different, more guided interaction pattern. The brief's "Student must NOT be a deliberately crippled version of Pro" instruction argues for the former (same real engines, genuinely bounded rather than artificially limited) over the latter.

## 12. Autonomy architecture

Confirmed: no shared autonomy/execution-budget infrastructure exists. What exists is two independent, hand-written constants (`MAX_INVESTIGATION_STEPS`, `MAX_RESEARCH_STEPS`) with near-identical doc comments explaining the same reasoning twice. Neither is quota-backed; both are plain exported numbers, checked in the orchestration loop itself, independent of frontend state (confirmed: the UI panels only ever render what the loop already decided, never influence it).

The brief's proposed autonomy dimensions (max steps, tool invocation, recursive investigation, cost limits, model selection, approval requirements, external actions, organizational permissions) map onto the current codebase as follows:

- **Max steps**: exists per-engine today (see above). Recommended: promote to a shared shape — `{maxSteps, maxToolCalls, maxNestedDelegations}` — that each engine's orchestration function accepts as a parameter object rather than a bare number, still resolved by the call site (not a new entitlement system), but now expressible as **capability metadata** (a field alongside `requiredFeature` on the registered `AICapability`) rather than a constant buried in each orchestration file.
- **Tool invocation / recursive investigation**: Research Intelligence's "delegate to Analysis Intelligence at most once" rule is the only precedent for bounding cross-engine delegation. A future Planning Intelligence that can chain Data → Analysis → Research → Domain needs this generalized, or its worst-case AI-call count compounds multiplicatively the way Research Intelligence's own doc comment already flags (§16).
- **Cost limits**: not currently expressed at all beyond the implicit step-count ceiling. No engine tracks token/dollar cost per investigation.
- **Model selection**: already real, shared infrastructure — `resolveProviderChain`/`runWithFallback`/`useProviderChain` (P1) — genuinely reusable by any future engine, unlike the step-budget pattern.
- **Approval requirements / external actions / organizational permissions**: no precedent exists anywhere in the codebase. This is purely Enterprise-tier future work.

**Recommendation:** represent autonomy as **capability metadata plus execution-limit parameters**, not a second billing/entitlement system — exactly the brief's own suggested framing, and consistent with how the codebase already treats `requiredFeature` as declarative metadata on a capability rather than inline logic scattered through call sites.

## 13. Domain Intelligence architecture

Not built; audited only as a design question. The brief's proposed structure —

```
                 ARRIYIA Intelligence Core
                           │
       ┌───────────────────┼──────────────────┐
       │                   │                  │
      Data              Analysis           Research
       │                   │                  │
       └───────────────────┼──────────────────┘
                           │
                  Domain Intelligence
                           │
        ┌──────────┬───────┼───────┬──────────┐
     Marketing   Finance  Sales  Strategy  Operations
```

— (Option B: domain modules operating over shared engines) is strongly supported by the evidence in this codebase, for one direct reason: **this is exactly the pattern Analysis Intelligence and Research Intelligence already both used**, twice, successfully. Analysis Intelligence added zero new computation, only orchestration over Data Intelligence; Research Intelligence added zero new computation, only orchestration (plus retrieval) over Analysis Intelligence. A `Marketing Intelligence` module built as Option A (an independent engine) would be the first engine in the codebase's history to *not* follow this reuse discipline, which the architecture-audit process itself has enforced at every prior phase boundary.

Recommended split: **shared** — all computation (Data), all investigation orchestration (Analysis/Research), the (future) evidence/provenance substrate, entitlement/capability registration, autonomy budgets. **Domain-specific** — vocabulary/prompt templates (what "return on ad spend" means vs. "gross margin"), which retrieval sources are relevant by default, and domain-specific output shaping (a Marketing brief looks different from a Finance summary, even when both are produced by asking Research Intelligence the same underlying "what does the evidence show" question).

## 14. Planning position

Not built. Audited only for architectural placement.

**Important disambiguation**, confirmed by direct code reading: `src/modules/intelligence/planner/planner.ts` already exports `buildReasoningPlan()`, explicitly documented as "the Reasoning Planner... performs no AI work." It is entirely deterministic — regex/rule-table intent classification (`classifyIntent`, `PLANNING_RULES`) plus already-resolved per-turn signals — and its *entire* output is "which chat-command chips to suggest and which response tone to use for this one turn." This is UX-turn machinery for the chat product experience, not the "turn validated understanding into action" capability the brief means by Planning Intelligence. The name collision is real and should be resolved before a genuine Planning Intelligence engine is built, to avoid two things in the codebase both plausibly answering to "the planner."

Real Planning Intelligence's likely position: a **higher-order orchestration capability**, not a fourth peer investigation engine. It should consume validated outputs — Data/Analysis/Research results, Knowledge Intelligence's graph/gaps, workspace objectives (`workspace_objectives`, already real from the Hub phase), memory, and (once it exists) Domain Intelligence — the same way Research Intelligence today consumes Analysis Intelligence's output rather than recomputing it. It should not itself perform analysis or research; it should sequence *calls to* the engines that do, honoring whatever shared autonomy budget exists by then (§12).

## 15. Decision position

Not built. Audited only for architectural placement.

**Same disambiguation as Planning applies, more sharply**: `src/modules/intelligence/decision/decisionFrameworkBuilder.ts`'s `buildDecisionFramework()` is *literally* labeled "UX-12 Phase 7 — Decision Intelligence" in its own doc comment, and is a small, honest, deterministic utility that extracts "A vs B" options from a chat message's text (regex-based) and returns a `DecisionFramework` with **empty** `pros`/`cons`/`risks` and `confidence: 'low'` always — the code's own comment explains this is deliberate, since fabricating plausible pros/cons with no real evidence behind them would violate the same "never invent content" discipline as everything else in this codebase. It is a legitimately reusable primitive (parsing two comparable options out of free text) but it is not, and was never meant to be, the "Decision Intelligence" this reassessment brief describes.

Real Decision Intelligence's likely position: consumes validated outputs from Analysis/Research/Planning (once Planning exists) rather than independently duplicating any of them, exactly as the brief specifies. The existing `extractDecisionOptions`/`buildDecisionFramework` scaffold is worth reusing as the *first, deterministic step* of a real Decision Intelligence flow (option identification), with the currently-empty `pros`/`cons`/`risks`/`recommendation` fields finally populated from genuine Data/Analysis/Research evidence per option — turning today's honest placeholder into the real thing, rather than discarding it.

## 16. Knowledge/Document/Research relationship

- **Document Intelligence** (`processing/documentIntelligence/module.ts`): a cross-cutting evidence-preparation capability (classify + structured extraction) every ingested document already passes through — not a peer of Data/Analysis/Research, closer to an ingestion-pipeline stage.
- **Knowledge Intelligence**: a genuine hybrid — `knowledge_nodes`/`knowledge_links`/`knowledge_node_sources` are an evidence *store* (deterministic confidence scoring via `computeKnowledgeConfidence`, a weighted sum of source count/diversity/freshness/relationship count — no AI call); the briefing generators (`generateBriefing.ts`, `generateWorkspaceBriefing.ts`) are a thin *engine-like* capability (one AI call, grounded in `KnowledgeNodeEvidence`, persisted as a Note); the Explorer/Graph/Collections pages are pure *product experience*.
- **Research Intelligence**: the only one of the three that performs a bounded, multi-step *investigation* — genuinely a different category from either of the above, not a duplicate of Knowledge Intelligence's briefing capability. The two do not currently share retrieval code (Research Intelligence calls `retrieveContext`/`retrieveNoteContext` directly; Knowledge Intelligence's evidence comes from `knowledge_node_sources`, a different table with a different provenance shape — see §10) even though both ultimately answer "what supports this claim." This is duplication worth resolving once the shared evidence abstraction (§7/§10) exists, not before.
- **"Knowledge gap" naming collision**: `computeKnowledgeGaps` (`src/modules/evolution/knowledgeGaps/knowledgeGaps.ts`) — a deterministic workspace-health/graph-topology signal ("isolated knowledge island", missing coverage) — is a **different concept** from Research Intelligence's own `ResearchGap` (an evidence-grounded gap identified within one investigation). Both are legitimate and both should exist, but the shared word risks confusion in product copy and documentation; recommend disambiguating as "workspace knowledge gaps" vs. "research gaps" going forward.
- **Notes** and **Memory** are evidence stores/product experiences, not engines, and are correctly treated as such by all three Intelligence engines audited (Research Intelligence reads Notes for evidence and writes to Notes for persistence; none of the three engines touch Memory, which remains scoped to user-preference/profile facts for chat personalization, not document evidence — confirmed no overlap with `knowledge_nodes`).

## 17. External research gap

Confirmed unchanged since Research Intelligence's own architecture audit: zero web/URL search, zero external-source fetch, zero bibliographic (title/author/url/publisher/date) model anywhere in the codebase. What would be required, documented as future infrastructure dependency only:

- A web-search provider integration (vendor choice is a product/cost decision, not an architecture one) — analogous in shape to how `EmbeddingProvider`/`ChatProvider` are already abstracted behind provider registries; a `WebSearchProvider` interface following the same pattern is the natural fit.
- A `source_url`/bibliographic extension to whatever the unified `EvidenceReference` shape (§10) becomes — `title`, `author`, `publisher`, `publicationDate`, `url`, `retrievedAt`, `accessMethod` — additive fields on top of the existing internal-source shape, not a parallel model.
- Source ranking/freshness/verification logic, entirely new — no precedent exists to reuse (the closest analogue, `hybridScore.ts`'s lexical/semantic ranking, ranks *internal* retrieval, not external source trustworthiness).
- Citation preservation through the same synthesis discipline Research Intelligence already enforces (never claim a source not actually returned by retrieval) — the discipline transfers directly; only the retrieval mechanism itself is missing.

## 18. Cost/quota architecture

`quotaService.checkQuota`/`consumeQuota` (`src/shared/lib/quotaService.ts`) route through `resolve_effective_quota_limit`/`consume_quota` Postgres RPCs — the single authoritative resolution path (per-user override coalesced with plan default), confirmed used consistently. Two categories of `quota_key` exist today:

- **Genuinely metered**: only `ai_messages` was confirmed actually consumed (`consumeQuota(userId, 'ai_messages')`, called from `AIService.ts` on both the ordinary-chat and workspace-action paths).
- **Boolean feature gates**: every `feature:*` key (`pro_intelligence`, `data_intelligence`, `analysis_intelligence`, `research_intelligence`, `collaboration`, ...) — `quota_limit = 1`, checked via `has_feature`, never incremented via `consume_quota`. Confirmed by grep: no `consumeQuota`/`consume_quota` call site anywhere in `data-intelligence/`, `analysis-intelligence/`, or `research-intelligence/`.

This means **none of the three Intelligence engines' AI usage is currently metered at all**, beyond the one-time boolean "is this feature unlocked" check — a Pro user can run an unlimited number of Analysis/Research investigations per month, each up to ~15 AI calls worst-case (Research Intelligence's own documented ceiling), for the cost of the one shared `ai_messages` quota that chat itself already competes for (and Analysis/Research investigations don't even consume that one). This is a genuine, currently-unaddressed cost exposure — flagged in Research Intelligence's own final report backlog and reconfirmed here.

**Recommended general future model** (not implemented): the brief's own proposed `Capability + execution budget + model budget + tool budget + step budget` shape is right-sized and should become shared infrastructure — most naturally as optional fields on the registered `AICapability` type (alongside `requiredFeature`), resolved once per capability rather than reinvented per engine. Whether *usage* is additionally metered via a real `quota_key` (as `ai_messages` already is) is a separate, secondary decision from the *ceiling* itself, which should exist regardless of whether it's ever actually billed.

## 19. Architectural debt

| Item | Severity | Notes |
|---|---|---|
| No unified provenance/evidence shape (six incompatible shapes, §10) | **Critical** | Blocks trustworthy multimodal/cross-engine citation; every future engine risks adding a seventh shape |
| No autonomy/execution-budget shared infrastructure (§12) | **High** | Two near-duplicate constants today; a chaining Planning engine will compound the problem multiplicatively |
| Intelligence engines' AI usage entirely unmetered beyond a one-time boolean gate (§18) | **High** | Real cost exposure once autonomous engines see real usage volume |
| "Decision Intelligence"/"Learning Intelligence" names already claimed by unrelated deterministic chat-UX scaffolds (§14/§15) | **High** | Will cause confusion or accidental collision the moment real Planning/Decision/Domain-adjacent "Learning" work starts; needs a naming decision before that work begins |
| Chat's automatic multimodal convergence and the typed engines' provenance pipelines are two disconnected paths (§7) | **High** | The "same reasoning substrate" claim in the brief's target architecture is not yet true end-to-end |
| No Student/Enterprise plan rows or capability-tier wiring; `maxSteps` params exist but nothing reads plan tier to set them (§11/§12) | **Medium** | Small, well-scoped follow-up once provenance/autonomy foundations exist |
| Image evidence cannot enter Data/Analysis/Research Intelligence (`ResearchSource` has no `'asset'` type) (§9) | **Medium** | Scoped, mechanical fix once the evidence abstraction exists |
| "Knowledge gap" (workspace/graph signal) vs. "research gap" (evidence-grounded, per-investigation) naming collision (§16) | **Medium** | Documentation/copy risk, not a code defect |
| No external-source/web-search layer at all (§17) | **Medium** | Correctly deferred by Research Intelligence rather than faked; still a real product gap |
| No voice/transcription infrastructure at all (§8) | **Medium** | Confirmed absent, not partially built; a clean future greenfield addition |
| Domain-module abstraction doesn't exist yet, but the reuse precedent for building it correctly (Option B) is already proven twice | **Low** | Not urgent; the pattern to follow is already validated, just not yet instantiated |

No critical bug was discovered during this read-only audit; all findings above are architectural gaps, not defects in shipped behavior.

## 20. Recommended intelligence taxonomy

**Intelligence engines** (bounded investigation, provenance-carrying, produce new validated understanding):
Data Intelligence · Analysis Intelligence · Research Intelligence · *(future)* Domain Intelligence · *(future)* Planning Intelligence · *(future)* Decision Intelligence

**Evidence stores / retrieval mechanisms** (hold or fetch raw material; do not themselves reason):
Documents + chunks · Notes · Assets/images · `structured_datasets` · Memory · Knowledge graph (`knowledge_nodes`/`knowledge_links`/`knowledge_node_sources` — hybrid store + light deterministic engine)

**Cross-cutting capabilities** (infrastructure every engine and experience depends on, not intelligence itself):
Capability registry + entitlement resolution · AI orchestration (provider chain/fallback, `runCapability`/`streamChatCompletion`) · Provenance *(needs unification — §10)* · Quota/cost control · Autonomy/execution budget *(needs unification — §12)* · Multimodal evidence intake *(needs abstraction — §7)* · Retrieval (hybrid semantic+lexical) · Workspace context · Collaboration

**Product experiences** (UI surfaces; not engines):
Chat (+ its own deterministic UX-turn machinery: `src/modules/intelligence/planner`/`decision`/`learning`/`strategy`/`orchestrator` — real, useful, but scoped to "how should this one chat turn look," not general intelligence) · Reader · Library/Document Detail · Executive Dashboard / Workspace Intelligence Hub · Search · Research page · Notes/Knowledge Explorer/Graph pages

**Domain intelligence** (not yet built — recommended as modules over shared engines, §13):
Marketing · Finance · Sales · Strategy · Operations

**Currently-misnamed placeholders** (exist, work correctly at their actual small scope, but their names collide with this taxonomy — flagged for a naming decision, not a rebuild):
`buildDecisionFramework` ("Decision Intelligence" in its own comment, actually chat-message option extraction) · `learningEngine.ts` ("Learning Intelligence," actually Reader pedagogical-stage tracking, unrelated to the Student tier) · `buildReasoningPlan`/"Intent Intelligence"/"Strategy" (chat response-tone/context-source selection, not task planning)

## 21. Dependency graph

The brief's proposed diagram is directionally right but needs two corrections: (1) a real shared **Evidence layer** does not exist yet — it is a prerequisite, not a given, and Image today only reaches this layer through chat's ad hoc convergence, not through the typed engines; (2) **Provenance** must run through everything below it as an explicit rail, or the "trustworthy cross-modal intelligence" property breaks the moment two engines' outputs are combined in one answer.

```
                MULTIMODAL EVIDENCE  (Text | Image | Voice[future] | Structured)
                           │
              [ NEEDS: unified EvidenceSource/EvidenceItem — §7 ]
                           │
              [ PROVENANCE RAIL running through every layer below — §10 ]
                           │
              ┌────────────┴────────────┐
              │                         │
             Data                  Knowledge Graph
    (structured_datasets)     (nodes/links/sources — store + light engine)
              │                         │
              └────────────┬────────────┘
                           │
                        Analysis
                           │
                        Research
                           │
              [ NEEDS: shared autonomy/execution-budget metadata — §12 ]
                           │
                 ┌─────────┴─────────┐
                 │                   │
             Planning              Decision
          (orchestrates the      (consumes validated
           engines above,         outputs from Analysis/
           never recomputes)      Research/Planning)
                 │                   │
                 └─────────┬─────────┘
                           │
                  Domain Intelligence
                  (modules over the shared
                   engines above — §13)
                           │
       Marketing │ Finance │ Sales │ Strategy │ Operations
                           │
                     Enterprise
            (organizational data/people/permissions/
             governance layered on the same substrate)
```

Cross-cutting, applying to every layer rather than sitting in the chain: capability registry + entitlement, AI orchestration/provider chain, quota/cost control, workspace context, collaboration.

## 22. New roadmap

**Foundations** (exist, solid): capability registry, entitlement resolution, provider chain/fallback, workspace context, Notes/Memory/Knowledge-graph stores, P1's chat convergence.

**Intelligence engines** (exist): Data, Analysis, Research. (Planned, not started): Planning, Decision, Domain.

**Cross-cutting capabilities** (partially exist, need unification before the next engine): Provenance (fragmented — §10), Autonomy/execution budget (duplicated — §12), Multimodal evidence abstraction (doesn't exist — §7), Cost metering for autonomous engines (doesn't exist — §18).

**Domain intelligence**: not started; architecture recommended (§13), implementation deferred.

**Commercial tiers**: Free/Pro real; Student/Enterprise not started (§11).

**Product experiences**: Chat, Reader, Library, Hub, Search, Research page — all real and stable; no redesign recommended or needed.

**Enterprise capabilities**: not started; entirely dependent on the provenance/autonomy foundations plus an organizational-permissions model that doesn't exist anywhere in the codebase today.

## 23. Recommended next sprint

**Not Planning Intelligence.** In priority order, with rationale:

1. **Provenance foundation** (§10, Critical debt). Unify or bridge the six existing shapes behind one `EvidenceReference` interface. Highest leverage: every subsequent recommendation depends on this existing first, and it's the one piece of debt severe enough to actively worsen (a seventh shape) if skipped.
2. **Multimodal evidence abstraction** (§7, High debt). Builds directly on (1); lets Image (and later Voice) evidence participate in Analysis/Research the way it already participates in chat.
3. **Autonomy/cost architecture** (§12/§18, High debt). Needed *before* Planning specifically, since Planning will chain across multiple engines and compound the existing unbounded-cost gap (§18) multiplicatively if built first.
4. **Planning Intelligence.** Now safe to build as a genuine higher-order orchestration capability on top of (1)-(3), consuming Data/Analysis/Research/Knowledge/objectives per §14.
5. **Decision Intelligence.** After Planning, since Decision should consume Planning's output too (§15); reuse `extractDecisionOptions` as its first deterministic step rather than discarding it.
6. **Domain Intelligence.** Can proceed in parallel with (4)/(5) once (1)-(3) exist, since its own dependency is the Data/Analysis/Research trio plus provenance, not Planning/Decision specifically (§13).
7. **Student/Pro capability-tier wiring.** Mostly plan-row/seeding work once (3) exists to give `maxSteps` something to read from; low engineering risk, can be sequenced opportunistically.
8. **External research infrastructure** (§17) and **Voice Intelligence** (§8). Independent, additive, no architectural blocker on either other than the general evidence abstraction — can proceed whenever product priority dictates, not gated by (4)-(7).

## 24. Deferred backlog

- Unified `EvidenceReference` provenance shape (§10) and its adoption across Data/Analysis/Research/Knowledge Intelligence.
- Multimodal `EvidenceSource`/`EvidenceItem` abstraction (§7), including an `'asset'` `ResearchSource` type once it exists (§9).
- Shared autonomy/execution-budget capability metadata (§12), replacing the two duplicated step-budget constants.
- Real usage metering for Analysis/Research Intelligence AI calls, beyond the current one-time boolean gate (§18).
- Naming resolution for "Decision Intelligence"/"Learning Intelligence"/"planner" before real Planning/Decision work begins (§14/§15).
- Terminology disambiguation: "workspace knowledge gap" vs. "research gap" (§16).
- Web-search/external-source provider integration + bibliographic metadata extension (§17).
- Voice/transcription ingestion pipeline (§8) — greenfield, no existing code to build on or around.
- `student`/`enterprise` plan rows and the capability/step-budget matrix in §11, once the above foundations exist.
- Persisting Research/Analysis investigation results for later reference (flagged already in Research Intelligence's own P2 backlog — still open).
- Persisting chat's `contextTrace` instead of discarding it (§7/§10), once a shape exists worth persisting it into.

## 25. Risks

- **Building Planning Intelligence before the provenance/autonomy foundations** risks a fourth incompatible provenance shape and an unbounded, multiplicatively-compounding cost surface (a Planning run chaining Research, which itself may chain Analysis — worst case already ~15 calls one level down).
- **Leaving "Decision Intelligence" and "Learning Intelligence" ambiguously named** risks a future engineer (or agent) extending the wrong module, or two genuinely different capabilities silently colliding in product copy/documentation.
- **Building Domain Intelligence as independent engines (Option A)** would be the first departure from the reuse discipline proven twice already, and would very likely reintroduce duplicated computation/interpretation logic the way Data/Analysis/Research explicitly avoided.
- **Treating Student as "Pro with a smaller number"** without also validating the UX (per the brief's own "must not be deliberately crippled" instruction) risks a Student tier that feels punitive rather than genuinely bounded-but-capable — a product risk, not purely an engineering one.
- **Deferring cost metering indefinitely** (§18) risks a real, unbudgeted cost exposure once Analysis/Research Intelligence usage grows beyond the current low-volume period this audit was performed in.

## 26. Benchmark strategy

Preserve all existing benchmarks unmodified (Data Intelligence's Product Sales fixture; Analysis Intelligence's multi-step scenarios over the same fixture; Research Intelligence's document/note/dataset-delegation scenarios) — all three remain green as of this audit (2316/2316 tests passing at `9fc73e8`, reconfirmed via `git log`, no test files touched by this document-only phase).

Recommended cumulative model, extending the brief's own framing:

- **Data** — Can ARRIYIA calculate? *(shipped, green)*
- **Analysis** — Can ARRIYIA investigate? *(shipped, green)*
- **Research** — Can ARRIYIA synthesize evidence honestly, across multiple internal sources, without fabricating? *(shipped, green)*
- **Multimodal** *(future)* — Can ARRIYIA combine text + image + structured data (+ voice, once it exists) as evidence for one answer, with unified provenance? Should be added only once §7/§10 exist — a benchmark for evidence unification before the unification exists would just encode today's gap as a permanent "expected failure."
- **Planning** *(future)* — Can ARRIYIA turn validated understanding (from Data/Analysis/Research) into a concrete, evidence-grounded plan, never inventing steps the evidence doesn't support?
- **Decision** *(future)* — Can ARRIYIA support a defensible decision by populating `pros`/`cons`/`risks` from genuine Analysis/Research evidence per option, rather than the current honest-but-empty placeholder?

No new benchmark infrastructure is needed yet — each future benchmark should follow the exact pattern already established three times: a real fixture, mocked-but-realistic AI planning content, real deterministic execution underneath, and independently-verified expected numbers, never narrative fluency substituting for a correct calculation.

---

*This document is the authoritative architectural basis for the next ARRIYIA Professional Intelligence implementation phase, per the reassessment brief's own instruction. It supersedes prior "8 intelligence layers" framing where the two conflict (§4/§20 taxonomy). It does not authorize, and should not be read as authorizing, the start of Planning, Decision, Domain, Voice, or Enterprise Intelligence implementation — see §23 for the recommended sequence and its own prerequisites.*
