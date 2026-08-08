# Knowledge Graph & Intelligence v2 (PIP Sprint 5/10)

See `knowledge-intelligence-layer-v2-discovery.md` for the full audit. This sprint is a validation sprint: nearly all of the graph/confidence/timeline/gap infrastructure already existed (Knowledge Intelligence Layer v1) and was confirmed correct. One real, structural gap was found and fixed — chat had no way to reach a named entity's graph evidence directly, only whatever happened to be sourced from a chunk-matched document. No parallel graph, recommendation, relationship, or intelligence engine was built.

## What was fixed

**`retrieveNamedEntityGraphContext.ts` (new)** — the graph-layer counterpart of Sprint 4's lexical chunk fix. Reuses `extractLexicalSearchTerms` (Sprint 4, unchanged) to pull candidate entity terms out of the user's question, `normalizeTitle` (Sprint 9A, unchanged) to look them up as exact-normalized `knowledge_nodes.title_normalized` keys, and — for whatever nodes match — `getKnowledgeNodeEvidence` (KIL v1, unchanged), the same rich function the Knowledge Explorer UI already uses: real evidence list, per-relationship confidence with evidence count and source types, overall node confidence. No new database query pattern, no new scoring formula, no second graph.

**`AIService.ts`** — this new context source runs alongside (not instead of) the existing `retrieveGraphContext`; the two text blocks are concatenated before being handed to `buildSystemPrompt`'s existing `graphContext` parameter, so no signature change was needed there. Both blocks already share the identical `"Concept: X"`/`"Entity: X"` line convention `buildGraphContextText` established, so `buildContextTrace`'s node-counting stays accurate across either source without any change to it either.

**Confidence framing embedded in the text itself**, not left as raw numbers: a node with confidence below 0.6 gets an inline `(limited evidence — treat as provisional)` or `(very limited evidence — treat with caution)` caveat; a relationship with zero shared corroborating sources is explicitly labeled `inferred, not directly corroborated` rather than presented flatly alongside a well-evidenced one. This directly answers Phase 5/6's "must never present confidence as certainty" and "distinguish direct evidence from inference" requirements using data that already existed (`RelationshipConfidence.evidenceCount`/`.sources`), not a new scoring system.

## What was intentionally not changed

- **Conflict/contradiction detection** — confirmed genuinely absent, and the existing confidence-model code already says so in its own comments ("would require an LLM comparing evidence passages pairwise... no such capability exists yet"). Building a pairwise-comparison engine is a real, separate feature — not attempted here, consistent with "do not build a parallel intelligence engine." What chat *can* do today: with the graph and chunk-retrieval fixes in place, more of the actual conflicting evidence (different sources' differing values) now reliably reaches the model's context in the first place — whether the model itself notices and flags the discrepancy is a live-model reasoning question, not a deterministic capability this sprint could add without new infrastructure.
- **Fuzzy/abbreviation entity matching** — deliberately not built. `normalizeTitle`'s exact-match-only design is correct per this sprint's own explicit instruction ("do not aggressively merge entities without sufficient evidence... false merges are worse than missed connections").
- **Graph Workspace's document-only relationship-strength ranking** — a real, minor inconsistency (noted in the discovery doc) between the coarse visualization-ranking function and the cross-source-aware evidence function chat now uses. Not touched: fixing it means changing graph visualization code, and no genuine blocking defect was found there (Phase 12's own instruction).
- **Automatic full extraction on note/conversation save** — confirmed intentional (cost-conscious): notes/conversations link into already-known entities rather than triggering a new LLM extraction call on every save. Not changed.
- **A second search/graph/relationship engine** — the fix is one new file reusing four already-existing, already-tested functions (`extractLexicalSearchTerms`, `normalizeTitle`, `getKnowledgeNodeEvidence`, and the existing `graphContext` prompt slot). No new capability, no new prompt template, no new table.

## Intelligence improvements

What NOVA can now do in chat that it could not before this sprint: answer a question that *names* an entity ("What is ARRIYIA connected to?", "Who else is involved in the Northern Expansion project?") using that entity's real accumulated graph evidence — related concepts/entities with relationship type and corroboration count, source list, and an honest confidence caveat — even when no document chunk happened to be in that turn's semantic/lexical top matches, or when the entity's only graph presence came from a source type other than the one a chunk search would have surfaced.

## Cross-source intelligence

Confirmed already correct, not newly built: `knowledge_node_sources` already accumulates evidence from any combination of document, note, conversation, and asset (image) sources under one canonical node (case/whitespace/punctuation-insensitive title matching), and `computeRelationshipConfidence`'s evidence counting already treats a shared source of any type as corroboration — a relationship backed by a document *and* a note *and* an image counts all three. The gap this sprint fixed was reachability from chat, not the underlying cross-source data model, which was already sound.

## Evidence & confidence

Unchanged computation (`computeKnowledgeConfidence`, `computeRelationshipConfidence` — both KIL v1), newly *reachable* from chat and newly framed in plain language rather than a bare number: low-confidence nodes get an explicit caveat, relationships with no shared corroborating evidence are labeled as inferred rather than presented as fact.

## Conflict detection

Confirmed genuinely absent, honestly reported as a real limitation rather than built as a rushed pairwise-LLM feature this sprint didn't have room to test properly. What's true today: the retrieval and graph fixes (this sprint and Sprint 4) make it substantially more likely that genuinely conflicting evidence (e.g. two different budget figures) both reach the model's context in the same turn — the base prompt's existing "answer using ONLY the context... if it doesn't contain the answer, say so" instruction is the only guard against the model silently picking one value, and that instruction was not strengthened specifically for numeric conflicts this sprint (a targeted follow-up, not attempted here to avoid scope creep beyond the diagnosed gap).

## Knowledge gaps

`detectTopicalKnowledgeGaps` (KIL v1) already answers "what's plausibly missing" as an explicit suggestion, never a fabricated fact ("X possible gaps... as a suggestion to confirm, not a certainty") — confirmed correct, unchanged.

## Testing

13 new tests, all deterministic at the retrieval/context-contract boundary, never asserting on a particular LLM's wording:
- `retrieveNamedEntityGraphContext.test.ts` (9) — returns null with no entity-like terms (no wasted query); looks up a node by normalized title and surfaces its real evidence; returns null (never fabricates) when no node matches; never throws on a Supabase failure; low-confidence nodes get a provisional caveat, well-corroborated ones don't; a relationship's evidence count/source types are surfaced; zero-evidence relationships are labeled inferred, not corroborated; empty input short-circuits.
- `AIService.test.ts` (+4, "Named-entity graph context") — the raw question text and userId reach the new function; its output appears in `<knowledge_connections>` even when the existing chunk-sourced graph context is null; both graph-context sources merge into one block rather than one overwriting the other; no `<knowledge_connections>` block appears when neither source has anything.

Existing coverage already proving Phase 4's entity-resolution requirement (not duplicated): `normalizeTitle.test.ts` ("two already-equivalent titles normalize to the same key"), `knowledgeNodeResolution.test.ts`'s `decideResolutionAction` ("treats a different source_type as a different source... reuse" — the literal cross-document/cross-source-type merge case).

Full suite: `tsc -b` clean · `vitest run` — **1788/1788 passing** (13 new this sprint) · `oxlint` clean · `vite build` succeeds (pre-existing chunk-size warning only, unrelated). No regression to Milestones 1–4, provider routing, multimodal analysis, Universal Search, or Knowledge Exchange — full suite includes all of their existing tests, unchanged and passing.

## Security

No new database table, RPC, or edge function. The new lookup filters by `user_id` (same convention `resolveCanonicalNode`'s existing exact-title lookup already uses) and is additionally bounded by the unchanged `knowledge_nodes` RLS policy — verified by reading the policy SQL directly. No provider name, API key, or routing detail appears in any new string.

## Not verified (named explicitly, per this engagement's standing rule)

Per the same limitation reported for every prior milestone: this environment has no authenticated browser session against the deployed app. Phase 18's live acceptance script — uploading a real document/note/spreadsheet/image with overlapping entities and running the ten specified chat/search/graph checks — was **not run**. What's verified instead: the two root-cause layers (retrieval, Sprint 4; graph reachability, this sprint) are fixed and tested against realistic, deterministic reproductions of the reported failure mode, and the underlying cross-source evidence/confidence model was independently confirmed correct by reading and testing the actual code, not assumed from documentation.

## Deployment status

No edge function changes required — the fix is entirely in how chat's context is assembled client-side; `ai-chat` verified byte-identical to the repo, still v18, no drift.
