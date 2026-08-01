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
- **Knowledge Confidence** — every concept now carries a computed confidence score (shown as a percentage badge on both its Concept Card and its drill-down page's Overview), answering "how sure are we?" rather than just listing sources
- **Generate Briefing** — a Knowledge Actions v1 capability on a concept's drill-down page: an LLM synthesizes the concept's own evidence and relationships into a short briefing, which is saved as a real Note and linked back to the concept as new evidence — knowledge acting on itself, not just being viewed
- **Export Knowledge Package** — a one-click Markdown export of a concept's full picture (description, confidence, related concepts, evidence by source type) as a downloadable file, entirely client-side with no AI call
- **Knowledge Collections** — curated groupings that can hold any mix of documents, notes, conversations, images, and concepts in one named collection, unlike the Library's document-only, single-parent Collections (folders); "Add to collection" is available from every item's own page

## Navigation

- **Knowledge → Explorer** (sidebar) — the main card grid and interactive graph
- A document's **Detail page** has the "Analyze Document" control that triggers extraction for that document
- Click any concept card (in the Explorer, or from a Universal Search Concept Card) to reach its dedicated drill-down page
- **Knowledge → Collections →** (from the Knowledge dashboard's header) — the Collections list and, from there, each collection's own page
- Every document, note, conversation, image, and concept's own page has an **"Add to collection"** button

## Real-World Examples

- You've uploaded a dozen documents mentioning "Mtoni River Lodge" over months. Because of canonical dedup, there's one "Mtoni River Lodge" node, not twelve — its drill-down page shows every document, note, and conversation that ever mentioned it, in one place.
- After extracting concepts from several documents, you click "Reconcile knowledge graph" — NOVA finds that "Revenue," "Google Ads," and "Marketing Campaign" are related, and those relationships now show up on each concept's card.
- You write a note mentioning "Revenue" by name — without you doing anything AI-related, that note is now linked as evidence on the existing "Revenue" node, because the deterministic matcher recognized the mention.
- A concept with a single, months-old document mention shows a low confidence percentage; a concept corroborated by fresh documents, notes, and conversations alike shows a high one — at a glance, before you dig into the evidence yourself.
- Before a meeting about "Mtoni River Lodge," you click Generate Briefing on that concept's page — NOVA writes a few sentences summarizing what's known and how it relates to Revenue, saved as a note you can skim in seconds.
- You want to share what NOVA knows about a concept with someone outside the platform — Export Knowledge Package gives you a clean Markdown file you can send or paste anywhere.
- You're planning a trip: you create a "Mtoni Trip Planning" collection and add the relevant document, two notes, a conversation with NOVA, and the "Mtoni River Lodge" concept to it — one place to see everything related, even though it spans four different content types.

## Typical Workflows

1. **Extract, then reconcile**: upload documents, run "Analyze Document" on the important ones, then periodically run "Reconcile knowledge graph" to discover cross-document relationships once you have enough nodes.
2. **Explore by concept, not by file**: instead of remembering which document had something, open the Knowledge Explorer, search for the concept, and see every source that ever mentioned it.
3. **Let evidence accumulate passively**: once a concept exists, just write notes and have conversations normally — the deterministic matcher keeps attaching new evidence to existing concepts without any extra action from you.
4. **Act on a concept, not just view it**: from a concept's drill-down page, generate a briefing when you need a quick synthesis, or export the whole package when you need to take it outside NOVA.
5. **Curate across types**: when several different documents/notes/conversations/images/concepts all relate to the same project or topic, create a Collection and add each one from its own page — then revisit the collection instead of hunting across separate sections of NOVA.

## Best Practices

- Run "Analyze Document" on documents that actually matter, not everything indiscriminately — extraction is a manual, deliberate step for a reason; not every upload needs to become graph nodes.
- Reconcile the graph periodically rather than after every single extraction — cross-document relationship detection is more useful with a reasonable number of nodes to consider at once.
- Use the drill-down page's Timeline to sanity-check a concept's evidence — if something looks wrong (evidence that shouldn't be there), it usually traces back to a coincidental text match worth being aware of.
- Treat a low confidence score as a prompt to add corroborating evidence (a note, a related document), not as a verdict that the concept is wrong — confidence measures how well-attested something is in your own knowledge base, not whether it's true.
- Generate a briefing after a concept has real evidence attached, not immediately after it's discovered — a briefing on a concept with one thin source will read as thin as the underlying evidence.
- Use Collections for cross-type curation (a project, a trip, a topic spanning several kinds of content) and the Library's document Collections for simple document filing — reach for the one that matches what you're actually organizing.

## Common Mistakes

- Expecting notes and conversations to spontaneously become new concepts — the deterministic matcher only *links* already-known concepts, it never discovers new ones; new concept discovery is still the LLM extraction step, document-triggered.
- Assuming a concept's "workspace" reflects everywhere it's used — a concept's `workspace_id` reflects only where it was *first* discovered; the concept itself is shared across all your workspaces by design, so the same "Marketing" concept in two different workspaces is one node, not two.
- Deleting a source document and expecting its concepts to disappear too — document deletion doesn't cascade to the graph; the concept and its other evidence remain, only that one piece of evidence becomes an orphaned reference.
- Expecting Generate Briefing to research beyond what's already in the graph — it's grounded only in the concept's existing evidence and related concepts, the same discipline as every other capability in NOVA; it won't tell you something the platform doesn't already know.
- Confusing Knowledge Collections with the Library's document Collections (folders) — they're two different features with two different pages; a document can be in a Library folder and a Knowledge Collection at the same time, independently.
- Deleting a Knowledge Collection expecting its contents to be deleted too — deleting a collection only removes the collection and its membership links; every document, note, conversation, image, and concept inside it is untouched.

## Related Features

- **Library & Reading** (Chapter 1) — extraction is document-triggered from the Document Detail page
- **Notes** (Chapter 2) — notes both feed and are fed by the graph
- **Chat & AI** (Chapter 3) — chat messages feed the graph the same way notes do; chat responses are also grounded partly through graph context
- **Universal Search** (Chapter 5) — the graph is Search's "Knowledge" branch, distinct from the flat document/note/conversation results

## AI Capabilities

- Concept/entity discovery and cross-document relationship detection are both LLM-based — this is genuine model reasoning about what matters and how things relate
- Canonical dedup and evidence linking are **not** AI — dedup is exact-normalized-string matching, and the deterministic matcher is pure text matching against already-known titles. This split is deliberate: discovery needs judgment (LLM), linking doesn't (fast, free, predictable)
- Knowledge Confidence is also **not** AI — it's a deterministic weighted formula (source count, source-type diversity, freshness, relationship count), computed from data the graph already has, with no model call involved
- Generate Briefing is LLM-based, but tightly grounded: the prompt is built only from the concept's own description, related concepts, and evidence source labels — the model is instructed not to invent facts beyond what's given
- Export Knowledge Package is **not** AI — it's deterministic Markdown formatting of the same evidence the drill-down page already displays, entirely in the browser
- Knowledge Collections are **not** AI — creating one, adding items, and removing items are all direct, deterministic actions; NOVA doesn't suggest what belongs in a collection (yet)

## Limitations

- No node lifecycle management yet — you can't merge two nodes that should be one, split one that shouldn't be one, rename a node directly, or archive one
- The Knowledge Explorer's node list and graph rendering are not paginated or virtualized — very large graphs may render slowly
- Knowledge Confidence doesn't yet detect contradictions between sources, or factor in how much of a source document you've actually read — it measures corroboration and freshness, not correctness or your own engagement with the material
- Knowledge Confidence is scoped to concepts/entities only — individual documents, notes, and spreadsheets don't carry their own confidence score, since "corroboration" is only meaningful for something that aggregates evidence across sources

## Future Roadmap

- Contradiction detection between sources, and a reading-coverage signal, both folded into Knowledge Confidence once that infrastructure exists
- Node lifecycle operations (merge/rename/archive)
- Explorer virtualization/pagination for graphs that outgrow the current unbounded fetch
- Convert conversation → project, once a Project entity exists elsewhere in the platform to convert into
- Natural language commands over the graph and collections alike (e.g. "summarize everything about Mtoni")
- Collection-level actions (export a whole collection, generate a briefing spanning a collection) — v1 only supports these per-item
