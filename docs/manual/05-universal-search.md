# Chapter 5: Universal Search

## Purpose

Search is becoming ARRIYIA's front door — the fastest way to answer both "which file has this?" and, increasingly, "what do I know about this?" Those are different questions, and Universal Search answers both in one place rather than forcing you to pick a mode.

## Feature Overview

- **Document search** — semantic (embedding-based) search across your uploaded documents' chunks
- **Conversation search** — as of Phase 2A, results are grouped by whole conversation, not individual message: one card per conversation, showing the strongest-matching message, a match count, last-updated time, workspace, and a relevance star rating; clicking a result deep-links straight to the matching message and briefly highlights it
- **Notes search** — notes are a fully independent, first-class search source
- **Graph Layer (Concept Cards)** — as of Phase 2B, a distinct "Knowledge" section on the results page, separate from the flat document/note/conversation grid: search "Mtoni" and get a Concept Card showing everything ARRIYIA knows about Mtoni — evidence counts by source type and related concepts — not just files that contain the word
- **Hybrid semantic + lexical search** — every source runs a title match alongside its semantic search now, so an exact or partial-name query surfaces a result even if the embedding model didn't score it highly, and a result matching both ways ranks higher than one matching only semantically
- **Cross-provider ranking** — a document, a note, and a conversation with the same underlying relevance now get the same recency treatment; freshness is no longer a conversation-only advantage
- **Zero-result recovery** — an empty search tells you whether your library is genuinely empty or whether nothing matched this specific query, instead of one generic "no results" message either way
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
- Seeing "Matched by document title" (or note/conversation title) on a result with no obvious semantic connection to your query — that's the lexical fallback surfacing a title-only match; it's deliberately ranked lower than genuine semantic hits, not a sign something's broken.

## Related Features

- **Library & Reading** (Chapter 1) — document search source
- **Notes** (Chapter 2) — notes search source
- **Chat & AI** (Chapter 3) — conversation search source
- **Knowledge Graph** (Chapter 4) — the Graph Layer branch is a direct extension of the knowledge graph, not a separate index

## AI Capabilities

- Document/note/conversation search is embedding-based (semantic similarity) — an LLM call happens once, to embed your query text, not per-result
- Conversation grouping's relevance score is deterministic math (top similarity + a small support bonus for corroborating messages), not a model judgment
- Recency and lexical-match boosts are both deterministic math applied uniformly across every source after each provider's own search runs — no model involved
- The Graph Layer's concept lookup is exact title matching, not semantic — searching a concept's exact or partial name finds it; searching a loosely related phrase currently won't

## Limitations

- Lexical fallback is title-matching only (documents/notes/conversations) — it doesn't search full document body text the way semantic search does
- No confidence-weighted ranking beyond recency and lexical boosts yet — there's no unified score that also factors in things like corroboration across sources or contradiction detection (that's tied to the Knowledge Confidence work, Chapter 4's roadmap)
- Zero-result recovery currently only distinguishes "empty library" from "no match" — it doesn't yet suggest a rephrased query

## Future Roadmap

- Confidence-weighted ranking, once Knowledge Confidence scoring (Chapter 4) exists to draw on
- Zero-result recovery with suggested rephrasing, not just the empty-vs-no-match distinction
- Longer-term: Search evolving from "find documents" to genuinely "find knowledge, then expand into evidence" — Concept Cards are the first step in that direction
