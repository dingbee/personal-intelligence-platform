# Chapter 4: Knowledge Graph & Intelligence

## Purpose

This is where NOVA stops being a place you store things and starts being a system that knows things. Every important concept and entity across your documents, notes, and conversations becomes a node in a graph — one canonical node per concept, no matter how many times or where it's mentioned — with relationships between them and a full evidence trail back to every source.

## Feature Overview

- **Knowledge extraction** — LLM-driven discovery of concepts and entities from a document, triggered manually from that document's Detail page ("Analyze Document")
- **Cross-document relationship detection** — a separate, also-manual step ("Reconcile knowledge graph") that finds relationships between concepts discovered across different documents, not just within one
- **Canonical node dedup** — the same concept mentioned in five different documents becomes one node, not five; matching is exact-normalized-title, and every source that mentions it accumulates as evidence on that one node
- **Knowledge Explorer** — a searchable, filterable card grid of every concept/entity, showing its connections and source documents
- **Interactive Concept Graph** — a visual, SVG-based graph you can navigate: focus a node, expand or collapse its neighbors, pin nodes in view, trace the shortest path between two concepts
- **Graph clustering** — real connected-component analysis over the AI-discovered relationships, surfaced as named clusters in the Explorer, not just a type-based grouping
- **Deterministic concept matcher** — as of Phase 2B, every new note and every chat message is scanned (instantly, with no AI call) for mentions of concepts the graph already knows about, and that mention becomes new evidence for that concept
- **Node drill-down page** — click any concept to see its Overview (evidence counts by source type), Related Concepts (with confidence scores), every referencing document/note/conversation, and a chronological Timeline of when each mention happened

## Navigation

- **Knowledge → Explorer** (sidebar) — the main card grid and interactive graph
- A document's **Detail page** has the "Analyze Document" control that triggers extraction for that document
- Click any concept card (in the Explorer, or from a Universal Search Concept Card) to reach its dedicated drill-down page

## Real-World Examples

- You've uploaded a dozen documents mentioning "Mtoni River Lodge" over months. Because of canonical dedup, there's one "Mtoni River Lodge" node, not twelve — its drill-down page shows every document, note, and conversation that ever mentioned it, in one place.
- After extracting concepts from several documents, you click "Reconcile knowledge graph" — NOVA finds that "Revenue," "Google Ads," and "Marketing Campaign" are related, and those relationships now show up on each concept's card.
- You write a note mentioning "Revenue" by name — without you doing anything AI-related, that note is now linked as evidence on the existing "Revenue" node, because the deterministic matcher recognized the mention.

## Typical Workflows

1. **Extract, then reconcile**: upload documents, run "Analyze Document" on the important ones, then periodically run "Reconcile knowledge graph" to discover cross-document relationships once you have enough nodes.
2. **Explore by concept, not by file**: instead of remembering which document had something, open the Knowledge Explorer, search for the concept, and see every source that ever mentioned it.
3. **Let evidence accumulate passively**: once a concept exists, just write notes and have conversations normally — the deterministic matcher keeps attaching new evidence to existing concepts without any extra action from you.

## Best Practices

- Run "Analyze Document" on documents that actually matter, not everything indiscriminately — extraction is a manual, deliberate step for a reason; not every upload needs to become graph nodes.
- Reconcile the graph periodically rather than after every single extraction — cross-document relationship detection is more useful with a reasonable number of nodes to consider at once.
- Use the drill-down page's Timeline to sanity-check a concept's evidence — if something looks wrong (evidence that shouldn't be there), it usually traces back to a coincidental text match worth being aware of.

## Common Mistakes

- Expecting notes and conversations to spontaneously become new concepts — the deterministic matcher only *links* already-known concepts, it never discovers new ones; new concept discovery is still the LLM extraction step, document-triggered.
- Assuming a concept's "workspace" reflects everywhere it's used — a concept's `workspace_id` reflects only where it was *first* discovered; the concept itself is shared across all your workspaces by design, so the same "Marketing" concept in two different workspaces is one node, not two.
- Deleting a source document and expecting its concepts to disappear too — document deletion doesn't cascade to the graph; the concept and its other evidence remain, only that one piece of evidence becomes an orphaned reference.

## Related Features

- **Library & Reading** (Chapter 1) — extraction is document-triggered from the Document Detail page
- **Notes** (Chapter 2) — notes both feed and are fed by the graph
- **Chat & AI** (Chapter 3) — chat messages feed the graph the same way notes do; chat responses are also grounded partly through graph context
- **Universal Search** (Chapter 5) — the graph is Search's "Knowledge" branch, distinct from the flat document/note/conversation results

## AI Capabilities

- Concept/entity discovery and cross-document relationship detection are both LLM-based — this is genuine model reasoning about what matters and how things relate
- Canonical dedup and evidence linking are **not** AI — dedup is exact-normalized-string matching, and the deterministic matcher is pure text matching against already-known titles. This split is deliberate: discovery needs judgment (LLM), linking doesn't (fast, free, predictable)

## Limitations

- No node lifecycle management yet — you can't merge two nodes that should be one, split one that shouldn't be one, rename a node directly, or archive one
- The Knowledge Explorer's node list and graph rendering are not paginated or virtualized — very large graphs may render slowly
- No Knowledge Confidence score yet — a concept with one weak mention and a concept with forty corroborating sources currently look structurally the same on the card

## Future Roadmap

- Knowledge Confidence scoring — computed from source count, freshness, corroboration, and contradiction detection, letting NOVA eventually answer "how certain are we?" rather than just "here are the documents"
- Node lifecycle operations (merge/rename/archive)
- Explorer virtualization/pagination for graphs that outgrow the current unbounded fetch
