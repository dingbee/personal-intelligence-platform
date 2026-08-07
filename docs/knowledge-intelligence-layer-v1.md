# Knowledge Intelligence Layer v1 — Implementation Record

Companion to `docs/knowledge-intelligence-layer-v1-discovery.md` (the read-only audit performed first). This records what was actually built, per Feature Area, and how each one reuses the existing knowledge graph/search/recommendation stack rather than duplicating it.

## Product framing

The milestone's own philosophy — "NOVA should not only store what users know. NOVA should understand how knowledge connects" — is answered by extending five already-live systems (relationship detection, node confidence, evidence tracking, structural gaps, and ranked search) rather than building a second graph or a second ranking pipeline next to them. The discovery audit found the graph/relationship/confidence machinery largely already existed and well-tested; the real gaps were narrower than "no intelligence layer exists" — they were: two hard-partitioned graphs with no asset/conversation nodes, manual-only relationship discovery, no packaged per-relationship confidence object, an ungrouped evidence timeline, no structured query surface, no topical gap detection, and concept search running as a second silo outside unified ranking. This record follows that exact list.

## What was built

1. **Feature 1 — Knowledge Graph Visualization.** `GraphNodeType` (`knowledge-graph/api/types.ts`) gained `'asset'` and `'conversation'` — evidence source types that existed in `knowledge_node_sources` since Multimodal Intelligence v1 but had no graph representation. `buildSourceGraphAdditions`/`mergeGraphLayers` (`knowledge/intelligence/graphSourceNodes.ts`, pure) turn a concept's resolved evidence into extra `GraphNode`/`GraphEdge` entries; `getConceptSourceNodes` (`knowledge-intelligence/api/knowledgeMap.ts`) does the resolution (reusing `listKnowledgeNodeSourcesForNodes` + `fetchTitlesByIds`, the same batch pattern `getKnowledgeNodeEvidence` already uses). `InteractiveConceptGraph` gained a "Show sources" toggle that merges this second layer into the existing `GraphCanvas` render — the same renderer, same BFS (`graphNavigator.ts`), same interactive focus/expand/pin controls, all unchanged. The separate legacy "Content Connections" graph (`KnowledgeGraphPage`) was deliberately left untouched, per the discovery doc's own scoping.

2. **Feature 2 — Automatic Relationship Discovery.** `autoReconcileNewKnowledge` (`knowledge-intelligence/api/reconcileKnowledgeGraph.ts`) reuses the exact same `detect-cross-document-relationships` capability, `buildEdgeInputsFromRelationships`, and `upsertKnowledgeEdges` the manual "Reconcile AI Knowledge Graph" button already calls — scoped down to a small, bounded comparison set (new nodes + up to 20 other recent nodes, versus the manual button's 60) since this now fires automatically, fire-and-forget, at the end of every `runKnowledgeExtractionFromContent` run. Edges it creates are tagged `generated_by: 'ai:auto-detect-connections'`, distinct from the manual button's tag, so `listRecentAutoDiscoveredConnections` can read them back and surface "New connections NOVA found" as a dismissible panel on Knowledge Explorer (reusing the `dismissed_suggestions` infrastructure from AI Experience Intelligence v1 — no new dismissal mechanism).

3. **Feature 3 — Knowledge Confidence.** `computeRelationshipConfidence` (added alongside `scoreRelationship` in `knowledge/intelligence/relationshipStrength.ts`, same pure-function convention) returns exactly the `{relationship, evidenceCount, sources}` shape the milestone asks for: `relationship` is the edge's own already-persisted confidence (never recomputed), `evidenceCount`/`sources` come from intersecting both nodes' `knowledge_node_sources` across *all* source types (broader than the existing `scoreRelationship`'s document-only `sharedSourceCount`, added rather than changing that function's tested behavior). Rendered under each related-concept row on `KnowledgeNodeDetailPage` as "Backed by N shared sources (type, type)" — never a bare percentage with no explanation of what it's based on.

4. **Feature 4 — Knowledge Timeline.** `groupEvidenceByPeriod` (`knowledge-intelligence/timeline/knowledgeTimeline.ts`, pure) buckets the evidence `getKnowledgeNodeEvidence` already fetches into calendar-month periods, ordered earliest-first. No new table, no new query — `knowledge_node_sources.created_at` was already the mutation log this needed. `KnowledgeNodeDetailPage`'s flat "Timeline" list (most-recent-first) was replaced with this grouped, chronological "Knowledge Timeline" section, reading as progression rather than an activity feed.

5. **Feature 5 — Intelligence Queries.** `classifyIntelligenceQuery` (`knowledge-intelligence/queries/intelligenceQueryClassifier.ts`) is a deterministic, no-AI-call rule table — the same convention `intentClassifier.ts` already established — mapping free text to one of `evolution | related_sources | gaps | patterns | decisions`. `runIntelligenceQuery` dispatches to existing composers: evolution → `groupEvidenceByPeriod`, related_sources → `getKnowledgeNodeEvidence`, patterns → `buildGraphInteractionState().insights` (already-computed `computeGraphInsights`), gaps → `detectTopicalKnowledgeGaps` (below), and one new aggregator for decisions (`answerDecisionsQuery`, reading each evidence document/asset's already-stored `documentIntelligence.decisions`). Surfaced as an `IntelligenceQueryBox` on `KnowledgeNodeDetailPage` — scoped to "ask about the concept you're viewing," sidestepping free-text entity resolution, which the discovery audit confirmed has no existing capability to build on.

6. **Feature 6 — Knowledge Gaps.** `computeKnowledgeGaps` (existing, unchanged) already answers the deterministic half — orphaned concepts, unread/stale documents, stale memories, isolated islands. It cannot answer the milestone's own topical example ("strategy + marketing but no financial model"), which needs a semantic read of the concepts themselves. `detectTopicalKnowledgeGaps` adds exactly one new adaptive capability (`detect-topical-knowledge-gaps`, same `runCapability` pattern as `analyze-document-intelligence`), fed a workspace's existing concept titles, returning up to 3 `{label, reason}` suggestions — always rendered as a suggestion to confirm, never a detected fact, via a manually-triggered `TopicalKnowledgeGapsSection` on the Hub (cost-conscious, same manual-trigger discipline as the Reconcile button, since unlike `computeKnowledgeGaps` this is a real AI call).

7. **Feature 7 — Search Evolution.** Two additive changes, both applied uniformly the same way `applyRecencyBonus` already was: (a) `conceptSearchProvider` registers the same title-ILIKE lookup `searchKnowledgeConcepts` already did, but as a real `SearchProvider` in `searchProviderRegistry` — concept results now flow through `runUniversalSearch`'s one ranked list instead of a second, parallel call. `SearchPage` deduplicates by excluding `sourceType: 'concept'` from its flat list (the richer `ConceptCard` "Knowledge" section already shows them in full) rather than showing each concept twice. (b) `applyImportanceBonus`/`computeImportanceBonus` (`search/ranking/importanceScore.ts`, pure, capped at +0.1) add a small, uniform "importance" signal based on how many knowledge nodes cite a result as evidence (`knowledge_node_sources` counts, fetched once per search in `runUniversalSearch`) — a document three concepts depend on now ranks slightly above an identical-similarity result nothing references.

## What was deliberately not built, and why

See the discovery doc for full reasoning; summarized:

- **A second graph model, BFS/pathfinder, confidence formula, or gap detector** — everything above extends the existing `knowledge_links`/`knowledge_nodes`/`graphNavigator`/`computeKnowledgeConfidence`/`scoreRelationship`/`computeKnowledgeGaps`, never replaces them.
- **Unifying the legacy Content Connections graph with the AI Knowledge Graph** — a materially larger migration (no stored `relationship_type` there at all) not needed to satisfy Feature 1's own example.
- **A `knowledge_node_embeddings` table / true semantic concept search** — `searchKnowledgeConcepts`'s title-ILIKE approach is unchanged; Feature 7 only changed how its results are merged and ranked, not how they're matched.
- **A persisted graph-mutation event log** — Feature 4 is answered entirely from `knowledge_node_sources.created_at`, which already exists.
- **A general-purpose NL entity resolver for Feature 5** — the query box is scoped to the concept already on screen; free-text "which concept does this refer to" has no existing capability in this codebase to build on, confirmed by the discovery audit.

## Data flow

```
New content ingested (document/asset, existing pipeline)
  → runKnowledgeExtractionFromContent (existing)
      → knowledge_nodes / knowledge_links (existing)
      → autoReconcileNewKnowledge (new, fire-and-forget)
          → knowledge_links tagged 'ai:auto-detect-connections' (new)
              → listRecentAutoDiscoveredConnections → Knowledge Explorer panel (new)

Knowledge Explorer / Knowledge Node Detail (existing pages, extended)
  → InteractiveConceptGraph "Show sources" (new)
      → getConceptSourceNodes → buildSourceGraphAdditions → GraphCanvas (existing renderer)
  → Related concepts list
      → computeRelationshipConfidence (new) → {relationship, evidenceCount, sources}
  → Knowledge Timeline (existing evidence, newly grouped by groupEvidenceByPeriod)
  → IntelligenceQueryBox (new)
      → classifyIntelligenceQuery → runIntelligenceQuery → existing composers

Workspace Intelligence Hub (existing page, extended)
  → TopicalKnowledgeGapsSection (new, manually triggered)
      → detectTopicalKnowledgeGaps → detect-topical-knowledge-gaps capability (new)

Universal Search (existing pipeline, extended)
  → conceptSearchProvider (new) → merged into runUniversalSearch's one ranked list
  → fetchEvidenceCounts + applyImportanceBonus (new) → uniform importance signal
```

## Privacy/security

No new exposure of embeddings, vector IDs, internal ranking weights, or model/provider identity anywhere in this milestone — every new UI surface (confidence lines, timeline groupings, query answers, gap suggestions, search results) presents only titles, dates, and plain-language summaries, the same boundary every prior phase in this project has held. Tier gating follows the existing `canSelectProvider`-style predicate + `useCurrentPlan()`/`usePlatformAdmin()` pattern (per the discovery audit) — this milestone did not introduce a new tier axis or bypass; every new feature here is presentation-layer functionality already available to any authenticated workspace member, consistent with how the rest of Knowledge Intelligence (Explorer, Confidence, Gaps) is gated today. RLS is unchanged: every new query (`knowledge_node_sources`, `knowledge_links`, `knowledge_nodes`, `assets`, `extraction_metadata`) reads through tables whose existing single-owner RLS policies were not modified by this milestone.
