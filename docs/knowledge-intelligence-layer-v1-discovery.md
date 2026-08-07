# Knowledge Intelligence Layer v1 — Discovery Report

Read-only audit performed before any implementation, per this milestone's own "Phase 1 — Discovery First" instruction. Grounds every Feature Area below in what already exists so nothing gets rebuilt. Two parallel audits were run: one over the graph/relationship/confidence stack, one over search/memory/recommendations/timeline. Findings are merged and cited by file:line below.

## What already exists (do not rebuild)

| System | Lives at | Status |
|---|---|---|
| Polymorphic graph edges with `confidence` + `relationship_type` | `knowledge_links` table / `KnowledgeLink` type (`database.ts:332-347`) | Live, `confidence` is the LLM's own 0-1 self-estimate at edge-creation time |
| Multi-source provenance ledger | `knowledge_node_sources` table / `KnowledgeNodeSource` type (`database.ts:394-402`) | Live — one row per (node, source), with `created_at` |
| Same-document relationship detection | `detect-relationships` capability, invoked from `runKnowledgeExtractionFromContent` | Live, automatic, per-extraction |
| Cross-document relationship detection | `detect-cross-document-relationships` capability + `reconcileKnowledgeGraph.ts` | Live, but **manually triggered only** — one button on Knowledge Explorer, not run on ingestion |
| Node confidence scoring | `computeKnowledgeConfidence` (`knowledgeConfidence.ts`) | Live, tested, compute-at-read, shown on `KnowledgeNodeDetailPage` |
| Edge/relationship strength scoring | `scoreRelationship`/`computeRelationshipStrengths` (`relationshipStrength.ts`) | Live, tested, compute-at-read; `countSharedSources` today only counts shared **document** sources between two nodes |
| Multi-hop BFS / shortest path over the concept graph | `graphNavigator.ts` (`getNeighborhood`, `findShortestPath`, `computeVisibleNodeIds`) | Live, tested |
| SVG graph rendering | `GraphCanvas.tsx` | Live, renders both existing graphs today |
| Node evidence + a basic "mentioned in X — relative time" timeline | `getKnowledgeNodeEvidence` + the "Timeline" section on `KnowledgeNodeDetailPage.tsx:210-221` | Live — a flat, date-sorted list of evidence events, not yet grouped/framed as evolution |
| Structural knowledge-coverage gaps (orphaned concepts, unread/stale docs, stale memories, isolated islands) | `computeKnowledgeGaps` (`src/modules/evolution/knowledgeGaps/knowledgeGaps.ts`) | Live, wired into the Hub's `WorkspaceGapsSection` |
| Graph connectivity/growth signals (degree, orphan, fastest-growing) | `computeGraphInsights` (`graphInsights.ts`) | Live, but only feeds Knowledge Explorer/Timeline — never `recommendationEngine`/`resurfacingEngine`/`signalEngine` |
| Universal Search: semantic + lexical + recency ranking | `runUniversalSearch.ts`, `hybridScore.ts`, `crossProviderRelevance.ts`, `conversationScore.ts` | Live, tested, uniform across document/note/conversation/asset providers |
| Embeddings | `embeddings` (doc chunks), `message_embeddings`, `note_embeddings`, `asset_embeddings` + matching `match_*` RPCs | Live. **No `knowledge_node_embeddings` table** — a documented, unrealized design intent (`0012` migration comment) to join through `source_chunk_ids` instead |
| Concept/knowledge-node search | `searchKnowledgeConcepts.ts` (title `ILIKE` only) | Live, but runs as **a second, parallel path** alongside `runUniversalSearch`, not merged into one ranked list (confirmed at `SearchPage.tsx` — two separate rendered sections) |
| Memory ranking | `rankMemories.ts` (confidence + recency only) | Live, but **not connected to the knowledge graph at all** |
| Tier gating pattern | `canSelectProvider(planCode)` + `useCurrentPlan()` + early `<Navigate>` (`AdvancedSettingsPage.tsx:24-39`); admin/"Founder" bypass is the separate `usePlatformAdmin()`/`RequireAdmin.tsx` check | Live, the pattern to reuse |

## The real gaps (net-new work this milestone targets)

1. **Two hard-partitioned graphs, neither covering the full chain.** The "AI Knowledge Graph" (`InteractiveConceptGraph`, via `generateKnowledgeMap`) shows concept↔entity edges only. The separate "Content Connections" graph (`KnowledgeGraphPage`) shows document/note/highlight/tag only, with no stored relationship type. **Neither graph has an `asset` or `conversation` node type at all** (`GraphNodeType` in `knowledge-graph/api/types.ts:2` is `'document' | 'note' | 'highlight' | 'tag' | 'concept' | 'entity'`), even though `knowledge_node_sources.source_type` already records both as valid evidence. A user cannot see Concept → Document → Note in one view today.
2. **Relationship discovery on new content is manual.** `reconcileKnowledgeGraph` exists and works, but nothing calls it automatically when new knowledge nodes are created, and there's no "I found a connection" surfacing anywhere.
3. **No packaged per-relationship confidence object.** `knowledge_links.confidence` is a bare number; nothing composes `{relationship, evidenceCount, sources[]}` the way Feature 3 asks for.
4. **No evolution framing.** The evidence timeline exists but is a flat list, not grouped by time period or framed as "how this concept developed."
5. **No structured query surface.** General chat already retrieves graph/memory context, but there's no dedicated "ask about your own knowledge" classifier/dispatcher distinct from open-ended chat.
6. **Knowledge gaps are structural only**, not topical (the "you have strategy + marketing but no financial model" example needs a semantic read of what's *conceptually* missing, which `computeKnowledgeGaps` doesn't attempt).
7. **Search ranking has no relationship/importance signal**, and concept results aren't in the same ranked list as everything else.

## Scope decided for this milestone (extends, does not duplicate, any of the above)

- **Feature 1**: Extend the existing "AI Knowledge Graph" (not the separate legacy Content Connections graph, which stays untouched and out of scope) to add one more layer — each concept/entity node's evidence sources, pulled from `knowledge_node_sources` — rendered as `document`/`note`/`asset`/`conversation` leaf nodes via the same `GraphCanvas`. `GraphNodeType` gains `'asset'`/`'conversation'`. Reuses `generateKnowledgeMap`, `toGraphData`, `GraphCanvas`, `graphNavigator`'s BFS unchanged.
- **Feature 2**: After `runKnowledgeExtractionFromContent` upserts nodes for a new source, fire a small, automatic, scoped reconciliation pass (reusing `detect-cross-document-relationships` + `buildEdgeInputsFromRelationships` + `upsertKnowledgeEdges` — the exact same functions `reconcileKnowledgeGraph` already calls, just invoked with a small bounded comparison set instead of a manual full-graph button). Surface any newly created cross-source edge as a dismissible Hub item, reusing the existing `dismissed_suggestions` infrastructure from AI Experience Intelligence v1.
- **Feature 3**: Add `computeRelationshipConfidence` alongside `scoreRelationship` in `relationshipStrength.ts` (same file, same "pure, no I/O" convention), returning `{relationship, evidenceCount, sources}` by reusing `edge.confidence` and counting shared evidence across **all** source types (broader than `countSharedSources`'s document-only scope, additive not destructive). Rendered next to each related-concept row on `KnowledgeNodeDetailPage`.
- **Feature 4**: Group the existing evidence timeline by month via a new pure function, reframed as "Knowledge Timeline" — no new table, no new query, `knowledge_node_sources.created_at` is already the mutation log this needs.
- **Feature 5**: A small rule-based query classifier (same convention as `intentClassifier.ts`/`executiveBriefingCommand.ts` — deterministic, no AI call) dispatching to the four already-existing composers (timeline, evidence, gaps, `computeGraphInsights`) plus one new decisions aggregator, surfaced as a query box on `KnowledgeNodeDetailPage` (node already known from the route, so no entity-resolution problem to solve).
- **Feature 6**: Extend `computeKnowledgeGaps` is insufficient for the topical example given, so this adds exactly one new adaptive AI capability (`detect-topical-knowledge-gaps`, following the same `runCapability` pattern as `analyze-document-intelligence`), fed a workspace's existing concept titles, asking for plausible missing categories — explicitly labeled a model suggestion, never certainty, consistent with this project's own "no false certainty" discipline.
- **Feature 7**: (a) A new `conceptSearchProvider` implementing the existing `SearchProvider` interface, registered into `searchProviderRegistry` so concept results merge into `runUniversalSearch`'s one ranked list — directly closes the "two silos" gap. (b) An additive, uniformly-applied "importance" bonus in `crossProviderRelevance.ts` (same shape as the existing `applyRecencyBonus`), based on how many knowledge nodes cite a result as evidence (`knowledge_node_sources` count) — a proxy for structural importance, no new signal source needed.

## What this milestone deliberately does not build

- A second graph-rendering system, a second BFS/pathfinder, a second confidence formula, or a second gap detector — all reused as inventoried above.
- The legacy "Content Connections" graph (`KnowledgeGraphPage`) is left untouched; unifying it with the AI Knowledge Graph would be a much larger, separate migration (it has no `relationship_type` storage at all) and isn't necessary to satisfy Feature 1's example.
- A `knowledge_node_embeddings` table / true semantic search over node titles — `searchKnowledgeConcepts`'s title-ILIKE approach is kept; Feature 7 only changes *how its results are merged and ranked*, not how nodes are matched.
- A persisted graph-mutation event log — Feature 4 is answered from `knowledge_node_sources.created_at`, which already exists for this purpose.
- A general-purpose NL entity resolver for Feature 5 — the query box is scoped to "ask about the concept you're currently viewing," sidestepping the harder "which concept does free text refer to" problem, which the search agent's audit confirmed doesn't exist anywhere in this codebase yet.
