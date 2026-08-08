# Knowledge Graph & Intelligence — Discovery (PIP Sprint 5/10)

## Phase 1 — Environment verification

Repository `dingbee/personal-intelligence-platform`, branch `main`, clean working tree, `HEAD` at `adc4d30` (Sprint 4/10's own commit) before this sprint's changes. Supabase project `uzshazetfkjkrdnxwjtl`; `ai-chat` Edge Function confirmed still at v18, no drift (`mcp__Supabase__list_edge_functions`). Environment matches the expected PIP setup exactly — no mismatch, proceeded.

## Phase 2 — Full trace: source → extraction → entity/concept → relationship → evidence → graph → retrieval → intelligence

This sprint is a **validation** sprint. The knowledge graph, confidence model, timeline, gap detection, and intelligence-query infrastructure were almost entirely already built (`Knowledge Intelligence Layer v1`, `KIL v1` Features 1–7 — see `docs/knowledge-intelligence-layer-v1-discovery.md` for that prior sprint's own audit). This discovery focused on tracing whether that infrastructure is actually *reachable* the way this sprint's product goal requires — from a plain chat question, across every source type — and found one real, structural gap.

**Schema** (`0012_knowledge_intelligence_foundation.sql`, `0016_knowledge_node_identity.sql`, `0031_shared_knowledge_objects.sql`): `knowledge_nodes` (concept/entity, `title` + `title_normalized`, `source_type`/`source_id`, `generation_metadata`), `knowledge_node_sources` (many-to-many node↔source provenance ledger, one row per (node, source_type, source_id)), `knowledge_links` (polymorphic edges, `relationship_type`, `confidence`, `generated_by`). RLS on all three already covers owner-or-workspace-member visibility (verified by reading the policy SQL directly).

**Entity resolution** (`resolveCanonicalNode` / `normalizeTitle`, Phase 9A): exact-normalized-title matching only — `normalizeTitle` lowercases, collapses whitespace, and strips punctuation without merging words, so `ARRIYIA`/`Arriyia`/`arriyia` all resolve to the identical `title_normalized` key and the identical node. `decideResolutionAction` explicitly distinguishes `create` (new title) / `refresh` (same source re-extracting) / `reuse` (a *different* source resolving to an existing title — the cross-document/cross-source-type merge case) — and `reuse` never lets a later source's content overwrite an established node, only adds a `knowledge_node_sources` row. No fuzzy matching exists (by design) — this is the correct boundary Phase 4 asks for: real case/whitespace/punctuation variants unify, nothing merges on a guess.

**Extraction entry points differ by source type — a real, load-bearing finding:**
- **Documents (including spreadsheets, which are `documents` rows)**: `runKnowledgeExtraction` → `runKnowledgeExtractionFromContent` (extract-concepts → extract-entities → detect-relationships, all through the existing capability/provider-routing stack) is a **manual** action — the "Extract Knowledge" control on Document Detail. Nothing runs it automatically after upload/processing.
- **Images**: `useAnalyzeImage` calls `runKnowledgeExtractionFromContent` (`sourceType: 'asset'`) automatically, fire-and-forget, after "Analyze with NOVA" completes.
- **Notes and conversations**: never call the LLM-extraction pipeline at all. `matchKnownConcepts`/`linkKnownConceptsToSource` (Phase 2B) does deterministic, no-LLM substring matching against *already-known* node titles and records evidence (`knowledge_node_sources`) — but this path can only *link* an existing node, never *create* one. A brand-new entity mentioned for the first time in a note produces no graph node until some other source (a document extraction, or an image analysis) creates it.

This is a legitimate, cost-conscious design (LLM extraction is expensive; running it on every note keystroke-adjacent save would be noisy and costly) — not a bug to "fix" by making notes trigger full extraction. It is, however, essential context for the sprint's Phase 3 cross-source example: a document or image needs to be the one that *introduces* an entity; notes/conversations then corroborate it.

**Confidence model** (`computeKnowledgeConfidence`): four deterministic signals (source count with diminishing returns, source-*type* diversity, evidence freshness, relationship density), weighted sum in [0,1], no LLM call. Its own code comment explicitly and honestly lists **contradiction detection as not attempted** — "would require an LLM comparing evidence passages pairwise for conflicting claims; no such capability exists yet." This is the sprint's clearest, most honest signal of where the real gap is (Phase 9, Conflict Detection — see below).

**Relationship evidence** (`computeRelationshipConfidence`, `getKnowledgeNodeEvidence`): per-edge `{relationship, evidenceCount, sources}` — `evidenceCount` counts a shared source of **any** type (document, note, conversation, asset), exactly matching Phase 3's cross-source requirement; the coarser `scoreRelationship`/`computeRelationshipStrengths` used for Graph Workspace's "strongest relationships" visualization is, by contrast, **document-only** by its own documented design — a real, minor inconsistency, noted below as a limitation, not touched (fixing it means changing graph visualization, and Phase 12 says not to redesign the UI without a genuine blocking defect — this isn't one; it under-*ranks* cross-source relationships in one visual list, it doesn't hide or misrepresent them).

**Timeline** (`groupEvidenceByPeriod`): already generic — groups any node's evidence by calendar month, UTC-based, ordered earliest-first. Directly answers "How has the project evolved?" (Phase 10) for any node, regardless of source type.

**Intelligence queries** (`runIntelligenceQuery`/`classifyIntelligenceQuery`): answers evolution/related-sources/decisions/gaps/patterns questions — but only when scoped to a **specific node the user is already viewing** (`nodeId` param). Its own doc comment says why: it "sidesteps the harder free-text entity-resolution problem this codebase has no existing capability for." This confirms the central gap precisely.

**The central gap, confirmed by reading the actual retrieval code:** `retrieveGraphContext` (the function that puts a `<knowledge_connections>` block into chat's system prompt) only ever looks up nodes via `knowledge_node_sources` rows for the **documents/assets a chunk search already matched** (`documentIds`/`assetIds` derived from `retrieveContext`'s and `retrieveAssetContext`'s results). It has no path to look up a *named* entity directly. So a chat question like "What is ARRIYIA connected to?" (Phase 7, Query A) depended entirely on the *accident* of a document chunk being vector/lexically matched *and* that document having had extraction manually run on it. `getKnowledgeNodeEvidence` — the rich, already-tested, already-correct function the Knowledge Explorer UI uses (evidence list, per-relationship confidence, evidence counts, source types) — was never reachable from chat at all.

## Phase 15 — Security (read-only, before any change)

`knowledge_nodes`/`knowledge_node_sources`/`knowledge_links` RLS already correctly scopes visibility to the owner or a workspace member with `viewer`+ role (verified by reading `0031_shared_knowledge_objects.sql` directly, not assumed). No API keys, provider names, or routing internals appear anywhere in graph-context text. `ai-chat` remains a pure passthrough (unchanged this sprint, verified byte-identical to the repo, same as every prior sprint's check).

## Gap classification

| Area | Status | Notes |
|---|---|---|
| Graph schema (nodes/edges/evidence/confidence) | 🟢 WORKING | Built in KIL v1, correct as designed |
| Entity resolution (case/whitespace/punctuation variants) | 🟢 WORKING | `normalizeTitle` + exact matching, verified by existing tests |
| Cross-source-type evidence accumulation (`knowledge_node_sources`) | 🟢 WORKING | `decideResolutionAction`'s `reuse` case already covers this |
| Relationship confidence with evidence count + source types | 🟢 WORKING | `computeRelationshipConfidence`, already cross-source-aware |
| Knowledge timeline | 🟢 WORKING | Generic, reusable for any node |
| Per-node intelligence queries (evolution/sources/decisions/gaps) | 🟢 WORKING | Scoped to a node already on screen |
| **Chat reaching a named entity's graph evidence directly** | 🔴 BROKEN → 🟢 FIXED | `retrieveGraphContext` only reachable via chunk-matched documents; see Phase 4 fix below |
| Conflict/contradiction detection | ⚪ MISSING | Explicitly documented as not-yet-built in the existing confidence-model code; a real, separate feature (pairwise LLM comparison), not attempted here |
| Free-text cross-node entity resolution (fuzzy/abbreviation matching) | ⚪ MISSING (by design) | Exact-normalized only — correct per Phase 4's own "do not aggressively merge" instruction |
| Graph Workspace's "strongest relationships" ranking | 🟡 PARTIAL | Document-only shared-source counting (by its own documented design) under-ranks cross-source relationships in that one visualization; doesn't affect chat, evidence lookup, or per-node confidence, which are cross-source-aware |
| Notes/conversations creating brand-new nodes | ⚪ MISSING (by design) | Cost-conscious: notes/conversations only *link* existing nodes; a document or image extraction must introduce an entity first |
