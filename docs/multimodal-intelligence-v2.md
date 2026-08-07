# Multimodal Intelligence v2 — Visual Knowledge Intelligence — Implementation Record

Companion to `docs/multimodal-intelligence-v2-discovery.md` (the read-only audit performed first). This records what was actually built, what was deliberately not built, and where the boundaries are. Builds directly on `docs/multimodal-intelligence-v1.md` — v1 delivered the vision call, the metadata column, and the reused knowledge-extraction chain; v2 extends the same single pipeline rather than adding new ones per feature area.

## Product framing

The task's own product philosophy — "NOVA does not behave like a file reader. NOVA behaves like an intelligence layer that transforms visual information into knowledge" — is answered structurally, not just in copy: every image, regardless of what it depicts (a document scan, a dashboard screenshot, a spreadsheet, a handwritten page), goes through the same extended `analyze-image` call, the same knowledge-extraction chain, and the same document-intelligence chain. The four named "Feature Areas" (OCR, Screenshot, Spreadsheet Vision, Handwritten Notes) are prompt-level framings of one underlying operation, not four separate engines.

## What was built

1. **OCR becomes structured, not dead text.** `analyzeImage`'s system prompt (`src/modules/assets/intelligence/analyzeImage.ts`) now asks for `LANGUAGE:` and `CONFIDENCE:` alongside the existing `TEXT:` marker. `parseImageAnalysisResponse.ts` was rewritten from a single-marker parser into a generalized multi-marker one (order-independent, tolerant of missing markers) that returns `{ description, extractedText, detectedLanguage, confidence }`. `extractedText` is no longer stored inert: it now flows into `useAnalyzeImage`'s existing knowledge-extraction step (unchanged call, richer input) and into a brand-new asset search index (below) — so OCR output is both queryable in the knowledge graph and findable via Universal Search, closing the task's explicit "do not store OCR as dead text" requirement.

2. **Screenshot / spreadsheet-vision / handwritten-notes intelligence, via one adaptive prompt.** Rather than four capabilities and four parsers, the `analyze-image` prompt already asks the model to name specific figures, trends, and visible data (v1) — v2 adds the connective tissue: extracted content (description + visible text) is now also run through the existing `analyze-document-intelligence` capability, generalized this phase into `runDocumentIntelligenceFromContent` (`src/modules/processing/documentIntelligence/runDocumentIntelligence.ts`), the same split-function pattern `runKnowledgeExtraction` → `runKnowledgeExtractionFromContent` established in v1. A handwritten note describing "Meeting with John Friday. Need proposal by Monday." now genuinely produces dates, decisions, and tasks — not just a prose description — regardless of whether the source image is a whiteboard, a screenshot, or a handwritten page.

3. **Visual knowledge extraction.** No new code was needed here: v1's `runKnowledgeExtractionFromContent` already accepts arbitrary content against a polymorphic `sourceType`/`sourceId`, and `useAnalyzeImage` already called it. v2 confirms this still holds with richer input (description + transcribed text instead of description alone) and adds no second extraction path.

4. **Intelligence Confidence Layer.** `AssetAnalysis.confidence` (`src/shared/types/database.ts`) is `{ text, entities, relationships } | null`, each a `number | null`. The values are the model's own self-reported estimate — parsed from the `CONFIDENCE:` marker, clamped to `[0, 1]`, malformed/out-of-range entries dropped to `null` rather than silently coerced. This is stated as a self-estimate everywhere it's surfaced (prompt text, type-adjacent naming, UI copy) — never presented as a calibrated statistical guarantee, because no provider used in this deployment exposes one for vision output (confirmed in both the v1 and v2 discovery docs). `needsConfidenceReview` (`src/modules/assets/intelligence/assetConfidence.ts`) flags a result when any reported dimension is below `0.5`, and `ImageReaderPage` renders a visible review-requested banner when it does — "never pretend certainty" is enforced in the UI, not just recorded in data.

5. **Visual Intelligence Workspace UX.** `ImageReaderPage`'s Chat tab (already showing description + visible text + Analyze/Re-analyze from v1) gained: a detected-language label next to Visible Text, the confidence-review banner above, and — when `documentIntelligence` reports any dates/decisions/tasks — a summary count plus a "Convert to structured note" action. That action calls `buildStructuredNoteContent.ts`, a pure function rendering the description followed by `## Dates` / `## Decisions` / `## Tasks` markdown sections (tasks as a real `- [ ]` checklist), then creates a real `Note` via the existing `createNote`/`linkNoteToAsset` APIs and navigates to it. This is the resolution to "Convert into Notes + Knowledge Nodes + Tasks": Knowledge Nodes already exist via item 3 above; Tasks are a checklist inside a real Note rather than a fabricated Task entity this codebase doesn't have.

6. **OCR/image content becomes searchable.** New `asset_embeddings` table + `match_assets` Postgres RPC (`supabase/migrations/0039_asset_search.sql`), mirroring the existing `note_embeddings`/`match_notes` pattern exactly (HNSW cosine index, single-owner RLS). New `indexAsset.ts` (fire-and-forget, swallows its own errors, matches `indexNote.ts`'s contract) embeds `title + description + extractedText` and is called from `useAnalyzeImage` after analysis completes. New `assetSearchProvider.ts` registers with the existing `searchProviderRegistry` (`registerBuiltInProviders.ts`) using the same hybrid semantic+lexical scoring every other source type uses. `SearchResultCard` gained an `asset` source label/icon. This is what makes "OCR output must become searchable knowledge" literally true: an image's transcribed text is now indexed and retrievable the same way a note's or a document's content is.

## What was deliberately not built, and why

See the discovery doc §9 for the full reasoning; summarized:

- **A duplicate intelligence engine per feature area** — the task explicitly forbids this. OCR/Screenshot/Spreadsheet-Vision/Handwritten-Notes are framings of the same vision call plus the same document-intelligence extraction, not four capabilities.
- **Real, calibrated OCR confidence** (per-character/bounding-box accuracy) — no provider used here exposes this for vision output; the only honest option was a labeled model self-estimate, which is what was built.
- **A first-class Task entity** (with owners, due dates, reminders, a queryable table) — doesn't exist anywhere in this codebase yet; inventing one for this phase would be new product surface far beyond "convert a note into structured knowledge." Tasks are a markdown checklist inside a real Note instead.
- **Rigorous spreadsheet-screenshot table reconstruction** (actual row/column/formula parsing from pixels) — the existing `xlsx`/`csv` extractor already does this correctly for real spreadsheet files; a screenshot is described in prose by the vision model instead, same boundary v1 already drew for spreadsheet screenshots specifically.
- **Vision-grounded diagram/whiteboard structural extraction** (node/edge graphs from pixel coordinates) — same v1 boundary, unchanged: a diagram is described in prose, which still feeds the knowledge graph via item 3 above, just not as a coordinate-grounded structure.
- **Making Anthropic/Google actually vision-capable in this deployment** — the content-block code path (`ai-chat` edge function) is already symmetric across all three providers since v1; only `OPENAI_API_KEY` is configured here, which is an operational gap, not a code gap.
- **Agentic features** — out of scope per this phase's own instruction, unchanged from v1's boundary.

## Data flow

```
Image upload (existing, unchanged)
  → asset row (existing)
  → "Analyze with NOVA" (extended)
      → analyzeImage: vision call → description + TEXT + LANGUAGE + CONFIDENCE (extended prompt/parser)
      → assets.metadata (extended shape: + detectedLanguage, confidence, documentIntelligence)
      → runKnowledgeExtractionFromContent (reused, unchanged, sourceType: 'asset')
          → knowledge_nodes / knowledge_links (existing)
      → runDocumentIntelligenceFromContent (new split, reused capability)
          → assets.metadata.documentIntelligence (dates / decisions / tasks)
      → indexAsset (new, fire-and-forget)
          → asset_embeddings (new) → searchable via assetSearchProvider (new)

ImageReaderPage (extended)
  → confidence-review banner (needsConfidenceReview)
  → "Convert to structured note" (buildStructuredNoteContent)
      → real Note (existing createNote/linkNoteToAsset APIs)
```

## Privacy/security

No new exposure of provider internals, model names, or vision-routing mechanics — item 1-2's richer prompt output and item 6's search index both flow through the same server-mediated edge function and client-side query layer every other AI-derived content already uses. Confidence scores are surfaced as the model's own estimate, never implied to be a calibrated measurement, so no false certainty is presented to any tier. `asset_embeddings` carries the same single-owner `auth.uid() = owner_id` RLS boundary as every other embeddings table (verified directly against the applied migration) — no tier-based access change was needed because tiering in this app is a UI/feature-gating concern, not a row-level one, and no new UI surface here is tier-gated differently from the existing "Analyze with NOVA" action it extends.

## Extended by Knowledge Intelligence Layer v1

The roadmap item this doc's own "what was deliberately not built" section left open — assets participating in the knowledge graph as more than a `knowledge_node_sources` row with no visual representation — was closed by that later milestone, not by this one. `GraphNodeType` gained `'asset'`/`'conversation'` variants there, so an image analyzed here can now actually appear as a node in the AI Knowledge Graph (via `InteractiveConceptGraph`'s "Show sources" toggle), not just as an entry in a table nothing renders. See `docs/knowledge-intelligence-layer-v1.md` for the full record — no change to this document's own vision pipeline, capabilities, or asset search infrastructure was needed to support it.
