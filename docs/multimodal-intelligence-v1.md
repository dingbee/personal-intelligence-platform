# Multimodal Intelligence v1 — Implementation Record

Companion to `docs/multimodal-intelligence-discovery.md` (the read-only audit performed first). This records what was actually built, what was deliberately not built, and where the boundaries are.

## What was built

1. **Multimodal provider foundation.** `ChatProviderMessage.content` (`src/modules/ai/providers/ChatProvider.ts`) widened from `string` to `string | ChatContentPart[]`, additive — every existing text call site is byte-for-byte unchanged. `supabase/functions/ai-chat/index.ts` — the one place provider API keys are read, per its own header comment — gained three content-block builders translating a `ChatContentPart[]` into each provider's real wire format (OpenAI `image_url`, Anthropic `image`/`source.url`, Google `fileData.fileUri`). An image part carries a hosted URL (the asset's own short-lived signed URL), not inline base64 — no client-side fetch/encode step.

2. **Image analysis.** `src/modules/assets/intelligence/analyzeImage.ts` makes one vision-capable chat call directly through `streamChatCompletion` (the same logging/observability layer `runCapability` itself uses) — not through `runCapability`, because capability prompt templates are string-variable substitution only and can't carry an image. Output: a plain-language description and any visible text, parsed by the pure, tested `parseImageAnalysisResponse.ts`. Stored on a new `assets.metadata jsonb` column (`0038_asset_metadata.sql`) — additive, nullable, no backfill.

3. **Visual knowledge extraction, by reuse.** `runKnowledgeExtraction`'s concept/entity/relationship chain was generalized into `runKnowledgeExtractionFromContent` (`src/modules/knowledge-intelligence/api/knowledgeExtraction.ts`), taking a polymorphic `sourceType`/`sourceId` instead of a hardcoded `'document'`/`documentId` — the same convention `knowledge_nodes`/`knowledge_links` already use. `runKnowledgeExtraction` is now a thin wrapper around it; every existing call site is behavior-unchanged (verified by the full existing knowledge-intelligence test suite staying green). `useAnalyzeImage` chains both steps — analyze, then extract — as one "Analyze with NOVA" action, so an image goes from pixels to knowledge graph the same way a document does, without a second extraction system.

4. **UI entry point.** `ImageReaderPage`'s Chat tab replaced its "no vision/OCR this phase" disclaimer with a real "Analyze with NOVA" action, a result panel, and "Re-analyze." The copy is still careful: it doesn't claim NOVA can see the image mid-conversation, only that it can be asked to look once, and the result is what gets stored and fed into the knowledge graph. `ImageCard`'s own comment was updated to match reality.

5. **Document Intelligence v1** (orthogonal — pure text, no provider change). A new `analyze-document-intelligence` capability classifies a document and extracts explicitly-stated dates, decisions, and tasks, reusing `boundContent` (now exported from `knowledgeExtraction.ts` for exactly this) and the same `runCapability` pattern. Persisted to `extraction_metadata.metadata.documentIntelligence` via a targeted update — not `saveExtractionMetadata`'s full upsert, which would have silently clobbered `chapters`/`spreadsheet`. `DocumentIntelligencePanel` on Document Detail mirrors `KnowledgeExtractionPanel`'s exact shape.

## What was deliberately not built, and why

See discovery doc §6 for the full reasoning; summarized:

- **Dedicated OCR** (per-character confidence, layout/bounding-box output) — a genuinely different technology from "call a vision-capable chat model." This phase stores what it actually produces (a description and a best-effort text transcription) and never claims a calibrated accuracy figure no provider here exposes.
- **Handwritten notes → structured project/task/deadline conversion** — needs first-class task/project entities with owners and deadlines, which don't exist yet as objects in this app.
- **Spreadsheet screenshots** — would chain two speculative capabilities (vision text extraction, then structure inference from that text) instead of reusing the real, already-solid `xlsx`/`csv` extractor.
- **Diagram/whiteboard structural extraction** — the general analyze-image capability describes a diagram in prose (which does feed the knowledge graph), not a vision-grounded node/edge graph from pixel coordinates.
- **A unified "Upload anything" surface** — this phase adds one entry point (Images tab / `ImageReaderPage`), not Chat attachments or Reader-integrated upload.
- **Making Anthropic/Google actually vision-capable in this deployment** — the code path is symmetric across all three providers, but only OpenAI has a configured secret here; the other two need an operational (secrets) change, not a code change.
- **Agentic features** — explicitly excluded by this phase's own final instruction.

## Data flow

```
Image upload (existing, unchanged)
  → asset row (existing)
  → "Analyze with NOVA" (new)
      → analyzeImage: signed URL + vision-capable chat call → description + visible text
      → assets.metadata (new column)
      → runKnowledgeExtractionFromContent (reused, sourceType: 'asset')
          → knowledge_nodes / knowledge_links (existing tables, existing Hub/graph wiring)

Document (existing, unchanged pipeline)
  → document_chunks (existing)
  → "Analyze Document Intelligence" (new)
      → runDocumentIntelligence: boundContent (reused) + runCapability (reused)
      → extraction_metadata.metadata.documentIntelligence (targeted update, new)
```

## Privacy/security

No new exposure of provider internals, model names, or routing mechanics — the vision call goes through the exact same server-mediated edge function every text call already uses, and the UI never surfaces which provider or model answered. Text extracted from an image flows into the same knowledge-extraction/memory pipeline as document text, under the same RLS boundaries, with no new prompt-injection surface beyond what already exists for document content.
