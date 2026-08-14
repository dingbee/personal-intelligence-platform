# Multimodal Evidence Abstraction — Architecture Audit

**Status:** Audit only. No application code, schema, migration, test, or entitlement changes were made in this phase.
**Baseline:** `a7d1d39` (ARRIYIA Intelligence Infrastructure — Provenance Foundation), branch `main`, repository `dingbee/personal-intelligence-platform`.

## 1. Executive Summary

The Provenance Foundation (`a7d1d39`) established a genuinely shared `Source → Evidence → Derivation` abstraction (`src/shared/provenance/`) with six adapters over existing engines. This audit traces every real multimodal path in the codebase against that abstraction and asks one question: **is the shared model sufficient for multimodal evidence to reach Analysis/Research/future engines without duplicating or redesigning existing systems?**

Finding, in one sentence: **the shared model itself is already sufficient — `SourceType` includes `'asset'`, `EvidenceLocation` already has a `'whole'` variant that honestly represents an unlocated image, and `assetAnalysisToProvenance` already proves the mapping works.** The actual gap is not in the abstraction; it is that **Research Intelligence's own evidence-gathering function (`gatherEvidence.ts`) never calls the asset-retrieval path (`retrieveAssetContext`) that already exists and already feeds Chat.** Every image-involving scenario this audit tested (Document+Image, Dataset+Screenshot, Research-with-images) is blocked by that one missing call, not by any deeper architectural incompatibility.

Voice/audio has **zero real infrastructure** anywhere in the repository — no upload path, no storage, no transcription, no persistence. The word "transcribe"/"transcribed" appears only in the image-analysis prompt (`analyzeImage.ts`), referring to OCR-style text-in-image extraction, never audio. `EvidenceLocation`'s `{kind:'segment'}` variant exists in the shared types purely as a forward-compatible type-level placeholder (constructed only in a provenance adapter test, never by any real code path) — this is documented, not hidden.

Recommended architecture: **Option C — Provenance remains canonical, each subsystem exposes a `toProvenance(...)` adapter.** This is not a new option being proposed; it is the pattern the Provenance Foundation already built and proved three times over (Data → Analysis → Research chain reuse). No universal `MultimodalEvidence` envelope, no second evidence store, no new database table is justified by anything found in this audit.

## 2. Repository Baseline

Verified directly, not assumed:

| Check | Result |
|---|---|
| Path | `/workspace/personal-intelligence-platform` |
| Remote | `origin` → `https://github.com/dingbee/personal-intelligence-platform` |
| Branch | `main` |
| Working tree | clean, no uncommitted changes at audit start |
| HEAD | `a7d1d39` — "ARRIYIA Intelligence Infrastructure — Provenance Foundation" |
| `a7d1d39` reachable | yes (`git cat-file -e a7d1d39` succeeds; it is HEAD itself) |
| Prior milestones present in `git log` | `f551872` (Post-P2 reassessment), `9fc73e8` (Research P2), `9bab3e7` (Analysis Foundation), `8dbdf44` (Data Foundation) — all present in `git log --oneline -5` |
| `docs/post-p2-intelligence-architecture-reassessment.md` | present |
| Equivalent existing multimodal audit doc | **not found** — `docs/multimodal-intelligence-discovery.md`, `-v1.md`, `-v2-discovery.md`, `-v2.md` and `pip-multimodal-intelligence-stabilization-v1*.md` exist but document *implemented features* (image analysis, OCR-in-image, document intelligence), not the provenance-abstraction architecture question this audit answers. This document is genuinely new. |

## 3. Existing Provenance Architecture

`src/shared/provenance/types.ts` defines exactly three concepts, per its own doc comment: a conclusion is not a fourth type, it is simply the outermost `DerivationReference` in a chain.

```ts
type SourceType = 'document' | 'note' | 'conversation' | 'asset' | 'knowledge_node' | 'dataset' | 'external'

interface SourceReference { type: SourceType; id: string; title: string }

type EvidenceLocation =
  | { kind: 'chunk'; chunkId: string }
  | { kind: 'rows'; sheetName: string; sheetIndex: number; rowCount: number }
  | { kind: 'region'; description: string }
  | { kind: 'segment'; startMs: number | null; endMs: number | null }
  | { kind: 'whole' }

interface EvidenceReference { id: string; source: SourceReference; location: EvidenceLocation; excerpt: string | null; retrievedAt: string | null }

type DerivationKind = 'calculation' | 'aggregation' | 'comparison' | 'observation' | 'synthesis' | 'interpretation'

interface DerivationReference { id: string; kind: DerivationKind; evidenceIds: string[]; basedOnDerivationIds: string[]; statement: string; method: string | null }
```

What it deliberately does **not** represent: it has no notion of confidence, no notion of permissions/authorization, and no notion of "who created this" (author/speaker) — these are left to the consuming engine and the caller's own already-enforced authorization boundary, by design (see `security.test.ts`, §16 below).

Six adapters exist under `src/shared/provenance/adapters/`, all read in full for this audit:

- **`dataIntelligenceAdapter.ts`** (`analyticalResultToProvenance`) — maps an already-computed `AnalyticalResult` into one `EvidenceReference` (`location:{kind:'rows',...}`, `excerpt:null` — the numbers live in the engine's own verified result, never duplicated) and one `kind:'calculation'` derivation. Returns `null` for a failed result.
- **`analysisIntelligenceAdapter.ts`** (`analysisInvestigationToProvenance`) — calls the Data adapter once per step, then wraps each step's `Observation`s as `kind:'observation'` derivations, and the investigation's synthesis as the closing `kind:'synthesis'` derivation (the conclusion).
- **`researchIntelligenceAdapter.ts`** (`researchInvestigationToProvenance`) — the deepest chain: for a `dataset_investigation` step it **splices in the nested `AnalysisInvestigation`'s own provenance chain via the Analysis adapter**, linking Research-level observations to the nested Analysis synthesis via `basedOnDerivationIds`. This is a genuine, already-proven three-engine chain (Data → Analysis → Research) in one structure.
- **`knowledgeGraphAdapter.ts`** (`knowledgeNodeEvidenceToProvenance`) — maps a `KnowledgeNodeEvidence` (node + citing sources) into a `SourceReference` for the node and one `EvidenceReference` per citing source, always `{kind:'whole'}` since `knowledge_node_sources` carries no finer location.
- **`retrievalAdapter.ts`** (`chunkMatchToEvidence`, `noteMatchToEvidence`) — maps a chat/Research retrieval match into an `EvidenceReference`; `retrievedAt` is always "now" since a retrieval match is inherently ephemeral.
- **`assetAdapter.ts`** (`assetAnalysisToProvenance`) — see §7 below.

`resolveEvidenceChain.ts` provides the one traceability primitive: a pure, in-memory, depth-capped (`MAX_CHAIN_DEPTH=10`) walk from a derivation back through its evidence and prior derivations, dropping (never fabricating) dangling references. `security.test.ts` statically greps every file under `src/shared/provenance/` to guarantee zero Supabase imports/calls — the module is provably a pure mapping layer, never an independent data-access path.

Where it is currently too narrow: nothing in the type system itself is too narrow for the modalities that exist today (see §13's gap matrix). Where it would be too narrow if extended carelessly: adding per-modality fields (image width/height, chunk embedding vector, etc.) directly onto `EvidenceReference` would create the "overloaded universal object" the brief explicitly warns against — the existing discriminated-union `EvidenceLocation` design is the right pattern to keep extending, not a generic bag of optional fields.

## 4. Multimodal Input Inventory

| Modality | Real infrastructure | Storage | Status |
|---|---|---|---|
| Text (documents) | Upload → extraction → chunking → embeddings | `documents`, `document_chunks` tables | Mature, chunk-level location (`chapter_title`/`chapter_index`) |
| Text (notes) | `notes` module, full CRUD | `notes` table | Mature, whole-note granularity |
| Conversations | Chat, message history | `conversations`, `messages` | Mature |
| Structured data (spreadsheets) | `structured_datasets`, `AnalyticalPlan`/`AnalyticalResult` | `structured_datasets` table | Mature, row/sheet-range granularity |
| Images | Upload, derivative generation, vision analysis (`analyzeImage.ts`) | `assets` table + storage buckets | Mature for description/OCR-text; no regions/coordinates |
| Knowledge graph | Extraction, nodes, edges, evidence links | `knowledge_nodes`, `knowledge_links`, `knowledge_node_sources` | Mature, whole-source granularity only |
| Voice/audio | **None** | — | **Absent** — confirmed by repository-wide grep (§8) |
| Video | **None** | — | Absent |
| Scanned/OCR PDFs | Handled via the same image-analysis path if uploaded as an image; PDF *documents* go through text extraction (`pdfProcessor`), not vision | — | Text-PDF path mature; image-of-a-document path only exists via Assets, not Documents |

## 5. Document/Text Audit

Document evidence flows: upload → extraction (writes `chapter_title`/`chapter_index`, e.g. literal `"Page N"` strings for PDFs, per `pdfProcessor`) → `document_chunks` rows → embedding → retrieval (`retrieveContext.ts`) → `resolveChunkProvenance.ts` resolves each matched chunk's `document_id`/`chapter_title` into a display label (`"{title} — {chapter_title}"` or just `{title}` when no chapter data exists) → fed into `buildSystemPrompt`.

The shared model's mapping is exact and already implemented: `chunkMatchToEvidence` (`retrievalAdapter.ts`) maps a `VectorMatch` to `{location:{kind:'chunk',chunkId}, source:{type:'document',...}}`. One genuine, narrow gap: **`chunkMatchToEvidence` takes the caller-supplied `documentTitle` but does not thread through the `chapter_title`/page label that `resolveChunkProvenance.ts` already computes** — the real page-level data exists in the database (for PDFs specifically) but is discarded at the provenance-adapter boundary rather than being carried into `EvidenceLocation`. This is a real, scoped, additive gap (see Backlog §20), not a structural incompatibility — `EvidenceLocation`'s `{kind:'chunk'}` variant could carry an optional label today without a breaking change, or a future `{kind:'page', pageNumber, chunkId}` variant could be added additively.

Original source vs. evidence: the distinction holds cleanly — `documents.id` is the source, a `document_chunks` row is the evidence, and there is no third "derived evidence" layer for plain text documents (unlike images, where OCR-text is itself a derivation of the source).

## 6. Structured Data Audit

`structured_datasets` (one row per sheet) is the source; `AnalyticalPlan`/`AnalyticalResult` (`src/modules/data-intelligence/analyticalPlan.ts`) is Data Intelligence's deterministic computation contract — the LLM only ever *proposes* a plan shape, `executeAnalyticalPlan.ts` is the only code that reads rows and produces numbers (confirmed via that file's own doc comment, unchanged in this audit).

`analyticalResultToProvenance` maps this exactly: `location:{kind:'rows', sheetName, sheetIndex, rowCount}`, `excerpt:null` (the numbers live in the caller's own already-verified `AnalyticalResult`, never re-serialized into the provenance layer — a correct anti-duplication choice), and one `kind:'calculation'` derivation whose `method` is a real, reconstructible description of the plan's measures (not a guess).

Is `{kind:'rows', sheetName, sheetIndex, rowCount}` sufficient for the current architecture? **Yes** — `AnalyticalResult.provenance` (the thing this adapter wraps) itself only ever carries `documentId`/`sheetName`/`sheetIndex`/`totalRowsInDataset`/`rowsMatchedAfterFilters`, never individual row indices or cell coordinates (confirmed by reading `dataIntelligenceAdapter.ts`'s consumption of it). The shared model cannot lose fidelity it was never given; extending `{kind:'rows'}` to carry row-level indices would require a prior change to `AnalyticalResult` itself, which is explicitly out of scope.

## 7. Image Audit

**Storage/identity:** `assets` table (`supabase/migrations/0022_assets.sql`) — `id`, `workspace_id` (nullable), `owner_id` (required, `on delete cascade`), `original_path`/`optimized_path`/`thumbnail_path`, `mime_type`, `width`/`height`, `size_bytes`. RLS: `auth.uid() = owner_id`, `for all` — the same ownership convention as every other table in this audit. A `metadata jsonb` column (added later, per task history #353) holds the `AssetAnalysis` payload.

**Analysis path:** `analyzeImage.ts` — a **one-shot vision call**, deliberately not a registered `capability` (capabilities only support string-variable prompt substitution, which cannot carry an image — confirmed by that file's own doc comment). It sends `{type:'image', imageUrl}` (a signed URL, never inline base64 — confirmed via `ChatProviderMessage`'s content-part union) to a vision-capable provider and parses the response into:

```ts
interface AssetAnalysis {
  description: string
  extractedText: string | null
  detectedLanguage: string | null
  confidence: { text: number|null; entities: number|null; relationships: number|null } | null
  documentIntelligence: { dates, decisions, tasks, ... } | null
  analyzedAt: string
  provider: string
}
```

This confirms: OCR-equivalent text extraction exists (`extractedText`, verbatim per the prompt's explicit "transcribed verbatim" instruction); **no region/coordinate data exists anywhere in the pipeline** — the parsed response is a flat text structure, never bounding boxes; confidence is genuinely self-reported by the model (the prompt explicitly frames it as "your own estimate, not a guarantee" — there is no calibrated/measured confidence anywhere in this codebase, for any modality).

**Is image analysis automatic or explicit?** Confirmed explicit: exactly two files call `analyzeImage`/`useAnalyzeImage` (`src/modules/assets/intelligence/analyzeImage.ts` itself and `src/modules/assets/hooks/useAnalyzeImage.ts`), the latter wired to an explicit "Analyze with NOVA" UI action (per task history #356/#364), not upload-time automation.

**Does image analysis reach Research/Analysis/Knowledge/Chat/provenance?**
- **Chat:** yes, fully — `retrieveAssetContext.ts` embeds the query, calls `match_assets` RPC, fetches the asset's `metadata`, and serializes it via `buildAssetContextContent` into a `<visual_context>`-equivalent prompt block. This runs concurrently with document/note retrieval inside `AIService.sendMessage` (confirmed reading the full function, §11).
- **Knowledge graph:** yes — `retrieveGraphContext` is called with `assetIds: [...assetMatches.map(m => m.assetId)]`, so an image's own knowledge-graph relationships are reachable once the image itself was matched.
- **Research Intelligence:** **no** — `gatherEvidence.ts` calls only `retrieveContext` (documents) and `retrieveNoteContext` (notes); it never calls `retrieveAssetContext`. This is the single most concrete, load-bearing gap this audit found (see §9, §13, §19 scenario matrix).
- **Analysis Intelligence:** not applicable directly — Analysis only ever consumes `structured_datasets` via Data Intelligence; there is no path (and no architectural need) for Analysis to consume raw image evidence directly, only via Research's delegation pattern once Research itself can see images.
- **Shared provenance:** yes — `assetAnalysisToProvenance` (§ below).

**`assetAnalysisToProvenance` assessment (the adapter built in `a7d1d39`):**
- Input: an already-computed `AssetAnalysis` plus `{id, title}` — never calls a provider or Supabase itself.
- Correctly distinguishes: **source** = the asset itself (`{type:'asset', id, title}`); **evidence** = `extractedText` when present, else `description` (never conflated); **derivation** = always `description`, `kind:'interpretation'`, kept conceptually distinct even when it happens to share text with the evidence (a description-only image has no separate transcription).
- `location` is always `{kind:'whole'}` — correctly honest, since `analyzeImage.ts`'s parsed output carries no coordinates. The adapter does not invent regions.
- Confidence: a below-0.5 self-reported score is preserved as an explicit caveat appended to the derivation's `statement` (`"... (low self-reported confidence: transcribed text)"`), never silently dropped or upgraded — verified directly against `assetAdapter.test.ts`.
- Multiple observations from one image: **not independently traceable today** — one `analyzeImage` call produces exactly one `EvidenceReference`/`DerivationReference` pair per asset; there is no mechanism (and no underlying data) to split "the chart trend" and "the table caption" in the same image into two separately-citable evidence items, because `AssetAnalysis` itself is a single flat description, not a list of discrete observations. This is a real limitation, inherited from `analyzeImage.ts`'s own output shape, not something the adapter could fix without a change to the vision-analysis contract itself (out of scope here).

**Conclusion for §7:** the adapter's `whole → interpretation` representation is sufficient and honest for what `analyzeImage.ts` actually produces today. It is not sufficient for a *future* region-aware or multi-observation vision pipeline — but the shared model does not need to anticipate that now; `{kind:'region'}` already exists in the type union for when it does.

## 8. Voice Readiness Audit

**Confirmed absent.** A repository-wide grep for `transcri|speech-to-text|audio_` across `src` and `supabase/migrations` returns only files that use the word "transcribe"/"transcribed" in the *image*-analysis context (`analyzeImage.ts`'s prompt, `buildAssetContextContent.ts`'s "Visible text" label) — there is no audio upload UI, no audio storage bucket, no transcription call, no transcript table, no speaker/timestamp model anywhere in the codebase. This matches and confirms the Post-P2 Reassessment's own finding; nothing here required design or implementation.

**Could the shared provenance model represent a future voice pipeline honestly?** The type system already anticipates this without any code path constructing it: `EvidenceLocation`'s `{kind:'segment', startMs, endMs}` variant exists specifically for this (per `types.ts`'s own doc comment: *"no code constructs a 'segment' location outside its own adapter test... exists solely to prove the shape is representable"*). A future pipeline would map as:

```
Audio Source        → SourceReference{type:'asset', id, title}   (a new asset kind, or a new SourceType — TBD when built)
Transcript Segment   → EvidenceReference{location:{kind:'segment', startMs, endMs}, excerpt: <segment text>}
Speaker/Timestamp    → NOT modeled in EvidenceReference itself — would live in a modality-specific field the way
                        image confidence lives in AssetAnalysis, not in the shared type (correct, per §13's
                        "do not over-unify" principle: speaker identity is audio-specific semantic meaning,
                        not evidentiary meaning the shared model needs to unify)
Observation/Analysis → DerivationReference{kind:'observation'|'interpretation', evidenceIds:[...segment ids]}
```

This requires **zero changes** to `src/shared/provenance/types.ts` to become representable in principle. What is missing is entirely upstream of provenance: no ingestion, no storage, no transcription call, no `AudioAnalysis`-equivalent type. Building Voice would look exactly like the Image Intelligence precedent (a new asset-adjacent module + one new adapter), not a provenance redesign.

## 9. Research Integration

`ResearchSource`/`ResearchEvidence`/`ResearchObservation` (`researchInvestigation.ts`) are Research Intelligence's own specialized types — deliberately not replaced by the shared model (Option C, per the researchIntelligenceAdapter.ts doc comment: *"ResearchSource/ResearchEvidence are NOT changed or aliased away; this file only adds a one-way mapping outward"*).

`ResearchSourceType = 'document' | 'note' | 'dataset_investigation'` — **no `'asset'` member.** This is confirmed to be a genuine, narrow gap, not a deep architectural one: the shared `SourceType` already has `'asset'`; the `assetAnalysisToProvenance` adapter and `retrieveAssetContext` (used identically by Chat) already exist; **only the wiring inside `gatherEvidence.ts` is missing** — it would need to (a) call `retrieveAssetContext` alongside its existing two calls, and (b) `ResearchSourceType` would need an `'asset'` member, and `researchIntelligenceAdapter.ts`'s `SOURCE_TYPE_MAP` would need one new line (`asset: 'asset'`). No new data model, no new adapter, no provider/model change.

`Analysis` delegation already models one asymmetric multimodal case: `ResearchStep.kind = 'dataset_investigation'` delegates to a real, unmodified `AnalysisInvestigation`, and `researchInvestigationToProvenance` already splices that nested chain in via `basedOnDerivationIds` — proving the "Research → shared evidence → doesn't get coupled to the underlying subsystem" pattern already works for one modality (structured data) today. Extending it to images is the same pattern, not a new one.

**Does closing the gap risk coupling Research directly to `imageService`/etc.?** No — `gatherEvidence.ts` already calls `retrieveContext`/`retrieveNoteContext` directly (not through an intermediate "evidence retrieval" abstraction layer), so adding `retrieveAssetContext` alongside them is consistent with the existing pattern, not a new coupling risk. Research is already, by design, coupled to the retrieval layer's specific functions — that is the existing architecture, and it is not broken by adding a third call of the same shape.

## 10. Analysis Integration

Analysis Intelligence (`AnalysisInvestigation`/`AnalysisStep`/`Observation`) consumes exactly one evidence source: `structured_datasets` via `executeAnalyticalPlan()`. There is no code path today, and this audit found no architectural requirement, for Analysis to directly consume image/text evidence — its role is strictly "deterministic computation over structured data," and that boundary is correctly preserved by every layer above it (Research delegates *to* Analysis, never the reverse; the provenance adapter reuses Analysis's own chain unmodified).

**Can Analysis eventually consume image-derived numerical observations (e.g., "the dashboard screenshot shows Q3 revenue = $40k") without bypassing `executeAnalyticalPlan()` for real calculations?** Yes, architecturally, via the same pattern Research already uses for text evidence: an image's `AssetAnalysis.documentIntelligence` (which already extracts dates/decisions/tasks in structured form) could become an *observation* Research cites, the same way a document chunk excerpt becomes an observation — never a *computation* Analysis performs. The critical boundary this audit confirms must remain: `executeAnalyticalPlan()` stays the only code that reads dataset rows and produces numbers; an image "showing" a number is evidence a human/LLM can *observe and cite*, never something Analysis recomputes from. No change is needed to enforce this — it is already how the architecture is shaped; the risk is entirely in *future* prompt design (e.g. a poorly-scoped Research synthesis prompt asking an LLM to "calculate" from an image), not in the type system.

## 11. Chat Integration

`AIService.sendMessage` (`src/modules/ai/orchestration/AIService.ts`, read in full) assembles six independent context sources **concurrently** per turn: `retrieveContext` (documents), `retrieveAssetContext` (images, wrapped in its own `.catch()` so a failure never blocks the turn), `retrieveNoteContext` (notes), `retrieveNamedEntityGraphContext`, `retrieveMemoryContext`, `retrieveSpreadsheetContext`. A second stage (dependent on the first) resolves `chunkSourcedGraphContext` and `chunkProvenance` (via `resolveChunkProvenance`), then everything is serialized into one system prompt via `buildSystemPrompt`.

Answering the ten required questions directly:

1. **What each source contributes:** each retrieval function returns typed matches (`VectorMatch`, `AssetContextMatch`, `NoteContextMatch`, etc.) with real ids and content — never free text at this stage.
2. **Representation used:** every source is serialized into **plain prompt text** by `buildSystemPrompt` before reaching the model — this is the conversion point where structure is lost (see point 8 below).
3. **Provenance survives (up to the prompt boundary):** yes — `resolveChunkProvenance` resolves real chunk/document/page labels before the prompt is built.
4. **Source identity survives (up to the prompt boundary):** yes — every match carries its real `documentId`/`assetId`/`noteId`.
5. **Evidence identity survives (up to the prompt boundary):** yes — `chunkId`, `assetId`, `noteId` are all real, resolvable ids.
6. **Confidence survives:** partially — `buildAssetContextContent` explicitly surfaces low self-reported confidence as prose ("say so if asked... rather than stating them as certain"), but this is a **textual caveat in the prompt**, not a structured field the model or a downstream consumer can programmatically read back.
7. **Modality survives (up to the prompt boundary):** yes, implicitly — each source has its own labeled block (`<visual_context>`-equivalent vs. document context vs. note context).
8. **Location within source survives:** yes for documents (page/chapter label) and structured data (sheet context), `{kind:'whole'}`-equivalent for notes/images.
9. **Can the contribution be cited later?** Only via `resolveReferences({matches})` — and this is scoped **exclusively to document chunk matches** (`matches`, not `assetMatches`/`noteMatches`) for the UI's reference chips (`references` in `SendMessageResult`). Images and notes retrieved into a chat turn are not currently surfaced as citable references in the UI, only as prompt content.
10. **Can it be reused by Research/Analysis?** No — this is the key finding confirmed directly: **chat's context-assembly pipeline is structurally disconnected from the typed engines' provenance pipelines.** `contextTrace` (`buildContextTrace.ts`) is explicitly documented as "logged not persisted... not user- or UI-facing yet" — it counts graph nodes/memories by regexing already-formatted prompt text (`/^(Concept|Entity): /gm`), which is a fundamentally different, lossier representation than the typed `EvidenceReference`/`DerivationReference` model. This confirms the Post-P2 Reassessment's finding exactly, at the code level.

**What would be required for chat to consume shared provenance without redesigning chat?** Nothing structural — `chunkMatchToEvidence`/`noteMatchToEvidence` already exist and could be called on `matches`/`noteMatches` the same way `resolveChunkProvenance` already is, additively, without touching the prompt-construction path at all. This is explicitly not implemented in this audit (out of scope) but is architecturally low-risk — see Backlog.

## 12. Knowledge Graph Integration

`knowledge_nodes` + `knowledge_links` + `knowledge_node_sources` (all read via `getKnowledgeNodeEvidence`, `src/modules/knowledge-intelligence/api/knowledgeNodeEvidence.ts`). This function is the clearest possible confirmation of the graph's actual role: it fetches the node, its citing sources (`knowledge_node_sources`, grouped by `source_type` — document/note/conversation), its outgoing/incoming `knowledge_links` to other nodes, and computes a deterministic confidence score (`computeKnowledgeConfidence`) from source-count/recency/related-concept-count.

**Which role does it play?** All three, cleanly separated by table, not conflated:
- **Evidence storage** — `knowledge_node_sources` is literally a source→node citation ledger (who claims this node exists), mapped 1:1 onto the shared model by `knowledgeGraphAdapter.ts`.
- **Derived knowledge** — the node itself (`title`, extracted from source text) is a derivation, not a source.
- **Relationship/retrieval index** — `knowledge_links` (node-to-node edges with `relationship_type`/`confidence`) has **no direct shared-provenance equivalent** — it represents a claim *about the relationship between two derivations*, which the current three-concept model doesn't need to represent (a relationship is not itself evidence, a source, or a derivation in the `Source→Evidence→Derivation` sense — it's graph-topology metadata one layer above). This is correctly left unmapped; forcing it into the shared model would be exactly the kind of over-unification §13 (of the brief) warns against.

`knowledgeNodeEvidenceToProvenance` maps only the node↔source-citation relationship, which is the one genuinely provenance-shaped part of the graph. It does not (and should not) attempt to represent `knowledge_links` — an adapter is the right boundary here, not a deeper architectural merge.

## 13. Provenance Gap Matrix

| Modality | Original Source | Evidence | Location | Derivation | Current Adapter | Missing |
|---|---|---|---|---|---|---|
| Document | ✓ (`documents.id`) | ✓ (chunk) | `{kind:'chunk'}` | n/a (documents have no derivation step of their own, only downstream engines derive from them) | ✓ `chunkMatchToEvidence` | Page/chapter label exists in DB (`chapter_title`) but is discarded, not threaded into `EvidenceLocation` |
| Note | ✓ (`notes.id`) | ✓ (whole note) | `{kind:'whole'}` | n/a | ✓ `noteMatchToEvidence` | None found — notes have no finer subdivision to lose |
| Spreadsheet/Dataset | ✓ (`structured_datasets.id`) | ✓ (row range) | `{kind:'rows'}` | ✓ `kind:'calculation'` | ✓ `analyticalResultToProvenance` | None found — matches `AnalyticalResult.provenance`'s own fidelity exactly |
| Image | ✓ (`assets.id`) | ✓ (description/OCR text) | `{kind:'whole'}` | ✓ `kind:'interpretation'` | ✓ `assetAnalysisToProvenance` | Regions/coordinates (no upstream data); multiple independently-traceable observations per image (upstream `AssetAnalysis` is a single flat description) |
| Knowledge node | ✓ (`knowledge_nodes.id`) | ✓ (citing source) | `{kind:'whole'}` | n/a (the node is itself a derivation of its sources, but the adapter doesn't currently emit a `DerivationReference` for the node-creation step, only a `SourceReference` for the node-as-cited-thing) | ✓ `knowledgeNodeEvidenceToProvenance` | No `DerivationReference` for "node X was derived from these sources"; `knowledge_links` (relationships) unmapped by design (§12) |
| Audio/Voice | — | — | `{kind:'segment'}` exists in type only | — | — | Everything — no ingestion, no storage, no transcription (confirmed absent, §8) |
| Video | — | — | — | — | — | Everything — no infrastructure found anywhere |
| Research (composite) | via delegation | ✓ document/note only | n/a | ✓ `kind:'observation'`/`'synthesis'` | ✓ `researchIntelligenceAdapter.ts` | `ResearchSourceType` has no `'asset'` member; `gatherEvidence.ts` never calls `retrieveAssetContext` (§9) |
| Chat context (ephemeral) | ✓ per-source | ✓ per-source | varies | n/a | **not adapted** — `contextTrace` counts formatted text, not typed evidence | The entire chat pipeline is disconnected from the provenance layer (§11) |

## 14. Architecture Options

**Option A — Universal Evidence Object.** Rejected: nothing in the repository supports collapsing a `document_chunks` row, a `structured_datasets` row-range, and an `assets` description into one physical/logical structure without losing type safety (`AnalyticalResult`'s numeric rows vs. an image's free-text description are not the same shape) or creating exactly the "overloaded universal object" the brief warns against.

**Option B — Typed Evidence Family** (`Evidence` base + `TextEvidence`/`TableEvidence`/`ImageEvidence`/... subtypes). Would require touching every existing engine's own already-shipped, already-tested types (`ResearchEvidence`, `AnalyticalResult`, `AssetAnalysis`) to conform to a new inheritance hierarchy — real migration cost, real regression risk to three engines that already work, for a benefit (compile-time modality discrimination) the existing discriminated-union `EvidenceLocation` already provides at the provenance layer.

**Option C — Provenance remains canonical; each subsystem exposes `toProvenance(...)`.** This is not hypothetical — it is exactly what `a7d1d39` already built and what this audit confirms works end-to-end for three engines (Data, Analysis, Research) plus two infrastructure sources (Knowledge Graph, Retrieval) plus Images. Zero migration cost (nothing existing changes shape), full type safety preserved per-engine, provenance fidelity is honest by construction (an adapter can only report what its source data actually has), and it is the only option with a track record in this codebase.

**Option D — Hybrid** (native evidence + shared provenance + a normalized multimodal *runtime* representation for consumption, e.g. an `EvidenceEnvelope` used only at the point Research/Analysis actually consume mixed evidence). Evaluated seriously per §22 of the brief (Evidence Envelope question) — **not recommended as new work this sprint**: `ResearchEvidence` (already a normalized, per-step runtime shape Research consumes uniformly regardless of source type) already plays this role for Research's own consumption. A separate `EvidenceEnvelope` would duplicate what `ResearchEvidence` already is, for no engine that doesn't already have one.

| | Option A | Option B | Option C (recommended) | Option D |
|---|---|---|---|---|
| Migration cost | High (rewrite 3 engines) | High (retype 3 engines) | **None** (additive only) | Low-medium (new type, but optional) |
| Type safety | Low (union of everything) | High | High (per-engine types unchanged) | High |
| Provenance fidelity | Risk of fabrication to fit one shape | Good | **Proven good** (adapters only report real data) | Good |
| Compatibility w/ Data/Analysis/Research | Breaking | Breaking | **Already proven compatible** | Compatible, additive |
| Security | New object = new surface to audit | New object = new surface to audit | **No new object** — nothing new to audit | New object = new surface to audit |
| Future Voice | Would need new subtype work regardless | Would need new subtype work regardless | **Already representable in type, per §8** | Would need new subtype work regardless |
| Extensibility | Poor (every new modality touches the universal shape) | Good but invasive | **Good, additive** (new `SourceType`/`EvidenceLocation` variant, new adapter) | Good |

## 15. Recommended Architecture

**Recommendation: Option C, extended additively — no new abstraction, two small wiring changes.**

```
Current state:

  Document ──retrieveContext──┐
  Note ──retrieveNoteContext──┼──> gatherEvidence.ts ──> ResearchEvidence ──> researchIntelligenceAdapter ──> shared provenance
  Image ──retrieveAssetContext┘         ↑ NOT CALLED

  Document/Note/Image ──> AIService.sendMessage ──> buildSystemPrompt ──> plain text (provenance lost at this boundary, §11)

Recommended state (additive only):

  Document ──retrieveContext────┐
  Note ──retrieveNoteContext────┼──> gatherEvidence.ts ──> ResearchEvidence{type:'document'|'note'|'asset'|'dataset_investigation'}
  Image ──retrieveAssetContext──┘         ↑ NOW CALLED, same pattern as the other two

  ResearchSourceType gains 'asset'; researchIntelligenceAdapter's SOURCE_TYPE_MAP gains one line (asset:'asset')
  → shared provenance already accepts it, zero changes to shared/provenance/types.ts required
```

Chat's own disconnection from provenance (§11, point 10) is a real gap but is explicitly **not** part of the Build-now scope — it is lower-value (chat's contribution is ephemeral/exploratory by design; Research is the engine meant to produce durable, citable findings) and higher-risk to touch (`AIService.sendMessage` is a large, heavily-tested, load-bearing function). See Backlog.

## 16. Security Implications

Every table this audit examined follows the identical ownership convention: `user_id`/`owner_id` (required, `on delete cascade`) + `workspace_id` (nullable) with `auth.uid() = <owner column>` RLS — confirmed directly for `assets` (§7's migration excerpt) and matching the pattern already documented for `documents`/`notes`/`structured_datasets`/`knowledge_nodes` in the Provenance Foundation's own security audit.

`security.test.ts` statically enforces (via a real grep, not a doc comment) that nothing under `src/shared/provenance/` imports the Supabase client or calls `.from()`/`.rpc()` — every adapter is a pure mapping over data the caller already fetched through the real, unmodified RLS boundary. This audit confirms that discipline held for the asset adapter too (`assetAnalysisToProvenance` takes an already-fetched `{id, title}` + `AssetAnalysis`, never queries anything itself).

**Does a provenance reference ever become an authorization bypass?** No — a `SourceReference{type:'asset', id, title}` is inert data; nothing in the codebase resolves a `SourceReference.id` back into a live read. The one place this *could* go wrong in a future implementation is if `gatherEvidence.ts`'s planned `retrieveAssetContext` call were added without preserving the existing `userId`/`workspaceId` scoping that call already enforces (`match_assets` RPC is called with `filter_workspace_id`, and asset rows are fetched by id after the RPC already scoped the match) — i.e., the risk is in *how* the wiring is done, not in the provenance layer itself. Recommendation: the future implementation must pass `userId`/`workspaceId` through exactly as `retrieveContext`/`retrieveNoteContext` already do in the same function, with no shortcut.

## 17. Performance/Cost Implications

- **Image analysis is already explicit/on-demand** (§7) — not automatic on upload — so adding Research's ability to *retrieve already-analyzed* images costs nothing extra in vision-model calls; `retrieveAssetContext` only reads `assets.metadata`, already computed.
- **Embedding deduplication already exists**: `AIService.sendMessage` embeds the query once and shares it across `retrieveContext`/`retrieveAssetContext`/`retrieveNoteContext` (explicit optimization from a prior sprint, per its own comment). `gatherEvidence.ts` does not yet share an embedding across its two (soon three) retrieval calls the same way — a small, real opportunity, not urgent.
- **No new embedding/OCR/transcription cost** is introduced by closing the Research gap — it reuses `assets.metadata` already computed once per explicit "Analyze" action.
- **Provenance construction itself is free** — every adapter is a pure, synchronous, in-memory mapping (`security.test.ts` proves no I/O), so extending it to Research's asset evidence adds no runtime cost beyond what `gatherEvidence.ts`'s new retrieval call itself costs (one additional `match_assets` RPC + asset row fetch, already paid by Chat on every turn).
- **Where evidence should be referenced vs. copied:** already correctly referenced, not copied, throughout — `EvidenceReference.excerpt` holds real text but `AnalyticalResult`'s numeric rows are never duplicated into provenance (§6), and `assets.metadata` is fetched fresh, not cached into a second copy. No caching/deduplication work is required to close the Research gap; it would only become relevant if Research started re-analyzing the same image across many steps, which is not how `gatherEvidence.ts`'s single-retrieval-per-step pattern works today.

## 18. Student/Pro/Enterprise Implications

The proposed change (closing the Research↔asset gap) is **capability-boundary-neutral**: `ResearchSourceType` gaining `'asset'` is a type-level change with no tier semantics attached — exactly as the brief requires ("the abstraction should not encode these tier differences directly"). Feature gating for Research Intelligence already exists via the dedicated `feature:research_intelligence`-equivalent key (per Research P2's own architecture) — adding image evidence to what Research can retrieve does not require a new capability key, a new plan row, or any entitlement change; it is gated by the same existing check that already gates Research access as a whole.

- **Student** — a future bounded-autonomy academic workflow ("summarize this paper and the accompanying chart") is architecturally supported once the Research gap closes, with no additional plumbing beyond what Pro would also use — the abstraction doesn't need a Student-specific evidence type.
- **Pro** — the direct beneficiary of closing this gap; multi-step multimodal investigation ("compare the diagram with the written explanation") becomes possible using existing infrastructure end-to-end.
- **Enterprise** — organizational evidence sharing/auditability is not blocked by anything found in this audit; `workspace_id` scoping already flows through every retrieval function examined (`retrieveContext`, `retrieveAssetContext`, `retrieveNoteContext`), so a future Enterprise permission layer would compose with the existing workspace boundary rather than requiring a parallel one.

## 19. Proposed Next Sprint

Scoped deliberately small, per the brief's own instruction not to turn this audit into an implementation plan. If a future sprint proceeds:

**Must build:**
1. `ResearchSourceType` gains `'asset'`; `researchIntelligenceAdapter.ts`'s `SOURCE_TYPE_MAP` gains `asset: 'asset'` (one line each).
2. `gatherEvidence.ts` calls `retrieveAssetContext` alongside its existing two calls, maps results into `ResearchEvidence` the same way document/note matches already are.

**Should build:**
3. Thread `resolveChunkProvenance`'s real page/`chapter_title` label into `chunkMatchToEvidence`'s output (optional `EvidenceLocation.{kind:'chunk'}` label, or a new `{kind:'page'}` variant) — closes the §5 gap.

**Later:**
4. Chat-to-provenance bridge (§11) — call `chunkMatchToEvidence`/`noteMatchToEvidence` on chat's own `matches`/`noteMatches` for a persisted `contextTrace` equivalent, without touching prompt construction.
5. Multiple independently-traceable observations per image (§7) — depends on a change to `analyzeImage.ts`'s output shape (out of scope for a provenance-only sprint).

**Backlog (§20 below).**

## 20. Backlog

| Item | Reason | Dependency | Affected modules | Complexity | Blocks Planning? | Blocks Voice? | Blocks Domain? |
|---|---|---|---|---|---|---|---|
| Research↔asset wiring (§19 items 1-2) | Single largest scenario-matrix gap found | None — all pieces exist | `researchInvestigation.ts`, `researchIntelligenceAdapter.ts`, `gatherEvidence.ts` | Low | No | No | Partially — Domain engines reusing Research inherit this gap |
| Page-label threading into `chunkMatchToEvidence` (§5, §19 item 3) | Real DB data discarded today | None | `retrievalAdapter.ts` | Low | No | No | No |
| Chat→provenance bridge (§11, §19 item 4) | Chat's contribution currently unreusable/uncitable by other engines | None, but touches a large already-tested function | `AIService.ts`, `buildContextTrace.ts` | Medium | No | No | No |
| Multi-observation image evidence (§7) | One image can only produce one citable observation today | Requires `analyzeImage.ts` output-shape change | `analyzeImage.ts`, `parseImageAnalysisResponse.ts`, `assetAdapter.ts` | Medium-High | No | No | No |
| `knowledge_links` relationship provenance (§12) | Relationships between derivations currently unmapped | Needs a design decision (relationship ≠ evidence) | `knowledgeGraphAdapter.ts` | Medium | No | No | No |
| Voice ingestion/storage/transcription | Zero infrastructure exists (§8) | Everything | New module | High | No | **Yes — this IS the Voice blocker** | Only if a domain needs audio evidence |
| Region/coordinate-aware vision analysis | No upstream data exists (§7) | Requires a different vision prompt/parsing contract | `analyzeImage.ts` | Medium | No | No | No |
| `EvidenceEnvelope`/normalized runtime object (Option D) | Not currently justified — `ResearchEvidence` already serves this role for Research | Would need a second consuming engine that *also* needs uniform runtime evidence before it's justified | New type | Low (if ever needed) | No | No | Possibly relevant once a second engine (e.g. a future Domain engine) needs the same normalization Research already has |

## 21. Final Recommendation

The shared provenance abstraction built in `a7d1d39` does not need to change to support multimodal evidence — it already can, and the `assetAnalysisToProvenance` adapter already proves it honestly for the one non-text modality that exists (images). The actual blocker to genuine multimodal intelligence is a specific, narrow, two-file wiring gap in Research Intelligence, not an architecture problem. Voice remains genuinely unbuilt, and the type system's forward-compatible `{kind:'segment'}` placeholder is sufficient preparation for it without building anything now. No universal evidence object, no second evidence store, no new database table, and no redesign of Data/Analysis/Research/Chat/Knowledge Graph is justified by anything found in this repository today.

---

**STOP.** This document is an architecture audit only. The Multimodal Evidence Abstraction, Autonomy/Cost architecture, Planning Intelligence, Voice Intelligence, and Domain Intelligence are not implemented here, and the existing Provenance Foundation is unmodified.
