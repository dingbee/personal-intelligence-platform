# Chapter 5: Universal Search

## Purpose

Search is becoming NOVA's front door — the fastest way to answer both "which file has this?" and, increasingly, "what do I know about this?" Those are different questions, and Universal Search answers both in one place rather than forcing you to pick a mode.

## Feature Overview

- **Document search** — semantic (embedding-based) search across your uploaded documents' chunks
- **Conversation search** — as of Phase 2A, results are grouped by whole conversation, not individual message: one card per conversation, showing the strongest-matching message, a match count, last-updated time, workspace, and a relevance star rating; clicking a result deep-links straight to the matching message and briefly highlights it
- **Notes search** — notes are a fully independent, first-class search source
- **Graph Layer (Concept Cards)** — as of Phase 2B, a distinct "Knowledge" section on the results page, separate from the flat document/note/conversation grid: search "Mtoni" and get a Concept Card showing everything NOVA knows about Mtoni — evidence counts by source type and related concepts — not just files that contain the word
- All sources run in parallel from a single typed query; results render as sections, not merged into one undifferentiated list

## Navigation

- **Search** (sidebar) — type a query, results appear grouped by source below
- The Command Bar's "Search library for..." action deep-links straight into Search with the query pre-filled

## Real-World Examples

- Search "direct booking" and get a ranked list of conversations that discussed it, each showing how many messages matched and how recently, rather than twenty separate message-level hits to sift through.
- Search "Mtoni" and the Knowledge section shows a Concept Card: "Mtoni River Lodge — appears in 18 documents, 9 notes, 13 conversations — related: Bookings, Hospitality, Revenue" — before you've even looked at a single file.
- Search "customer experience" and get relevant document passages, notes, and conversations all in one query, each in its own clearly-labeled section.

## Typical Workflows

1. **Search, then drill into a conversation**: search a topic, click a conversation result, land exactly on the matching message, already highlighted.
2. **Search, then drill into a concept**: search a name or topic, click its Concept Card, land on the full node detail page (Chapter 4) with every reference and related concept.
3. **Search as a substitute for remembering**: instead of trying to recall which document/note/conversation had something, just search for the concept and let Universal Search surface all of them at once.

## Best Practices

- Search with natural phrasing, not keywords — this is semantic search, so "what have I learned about X" works as well as "X."
- Check the Knowledge section first when your question is really about a concept ("what do we know about Mtoni") rather than a specific fact ("what did I write about pricing last Tuesday") — it's the faster path to the concept's full picture.
- Use conversation search's star rating as a rough relevance signal, not an absolute one — it factors in match strength, supporting message count, and recency together.

## Common Mistakes

- Expecting Search to find something that hasn't finished processing (an unembedded document, or a note saved before it existed) — indexing happens asynchronously, just like Chat grounding.
- Assuming the Knowledge section and the flat document/note/conversation results are the same thing — a concept card summarizes evidence across everything; the flat results below it show individual matching passages. They answer different questions and are meant to be read together, not interchangeably.
- Searching for a concept that hasn't been extracted yet and being surprised nothing shows up in the Knowledge section — the Graph Layer only knows concepts that extraction (Chapter 4) has already discovered.

## Related Features

- **Library & Reading** (Chapter 1) — document search source
- **Notes** (Chapter 2) — notes search source
- **Chat & AI** (Chapter 3) — conversation search source
- **Knowledge Graph** (Chapter 4) — the Graph Layer branch is a direct extension of the knowledge graph, not a separate index

## AI Capabilities

- Document/note/conversation search is embedding-based (semantic similarity) — an LLM call happens once, to embed your query text, not per-result
- Conversation grouping's relevance score is deterministic math (top similarity + a small support bonus for corroborating messages + a small recency bonus), not a model judgment
- The Graph Layer's concept lookup is exact title matching, not semantic — searching a concept's exact or partial name finds it; searching a loosely related phrase currently won't

## Limitations

- No hybrid lexical (keyword) fallback yet — a query an embedding model handles poorly currently has no keyword-based backup
- No cross-provider ranking normalization beyond conversation grouping's own scoring — documents, notes, and conversations are sorted by raw similarity relative to each other, without a unified relevance model across all of them yet
- No "zero result" recovery guidance yet — an empty result set is just empty, without suggested rephrasing

## Future Roadmap

- Cross-provider ranking refinement and confidence-weighted ranking, unifying how document/note/conversation/graph results compare to each other
- Hybrid semantic + lexical search
- Zero-result recovery (suggested rephrasing, broader queries)
- Longer-term: Search evolving from "find documents" to genuinely "find knowledge, then expand into evidence" — Concept Cards are the first step in that direction
