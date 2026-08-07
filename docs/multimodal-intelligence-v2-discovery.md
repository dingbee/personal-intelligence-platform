# Multimodal Intelligence v2 — Discovery Report

Read-only audit performed before implementation, per this phase's own instruction. v1 (`docs/multimodal-intelligence-v1.md`, commit `6fc9196`) is the direct foundation here — this phase extends it rather than re-auditing from zero, so this report focuses on what changed in understanding since v1 and what v2's specific asks require.

## 1. Existing multimodal architecture (confirmed current state)

- `ChatProviderMessage.content: string | ChatContentPart[]` (`src/modules/ai/providers/ChatProvider.ts`) and the matching `ai-chat` edge function content-block builders are in place and unchanged since v1. Still true: only `OPENAI_API_KEY` is a configured secret in this deployment.
- `src/modules/assets/intelligence/analyzeImage.ts` makes one vision call via `streamChatCompletion` (not `runCapability` — capability templates are string-substitution only), producing `{ description, extractedText }`, parsed by the pure `parseImageAnalysisResponse.ts`. Stored on `assets.metadata` (`AssetAnalysis` type, `0038_asset_metadata.sql`).
- `useAnalyzeImage` composes two reused steps as one "Analyze with NOVA" action: the vision call, then `runKnowledgeExtractionFromContent` with `sourceType: 'asset'`.

## 2. Asset pipeline

Unchanged from v1's audit: file-management pipeline (upload/validate/derivatives/store), now with one content-understanding layer on top (`analyzeImage`). `assets.metadata` is the one place asset-level AI output lives — v2's confidence/language additions extend this same jsonb column, not a new one.

## 3. Document intelligence pipeline

`src/modules/processing/documentIntelligence/`: one capability (`analyze-document-intelligence`), one pure parser (`parseDocumentIntelligenceResponse.ts`), one orchestration function (`runDocumentIntelligence`), persisted to `extraction_metadata.metadata.documentIntelligence`. Critically: `runDocumentIntelligence`'s body is **not yet generalized** the way `runKnowledgeExtraction` was in v1 — it's still hardcoded to fetch `document_chunks` via `documentId`. v2's Feature Area 4 (handwritten notes → dates/decisions/tasks) needs this same capability applied to an asset's analyzed text, not a document's chunks. The correct move, following v1's own precedent exactly: extract a `runDocumentIntelligenceFromContent(content, ...)` core (mirroring `runKnowledgeExtractionFromContent`), with `runDocumentIntelligence` becoming a thin document-chunk-fetching wrapper around it — not a second capability, not a second parser.

## 4. Knowledge extraction pipeline

`runKnowledgeExtractionFromContent` (`src/modules/knowledge-intelligence/api/knowledgeExtraction.ts`) already accepts any `sourceType`/`sourceId` — confirmed working for assets since v1. No changes needed here for v2; Feature Area 5 ("Visual Knowledge Extraction") is already satisfied by this existing wiring for any image whose analyzed text is fed through it.

## 5. Provider vision capabilities

Unchanged: OpenAI functional, Anthropic/Google symmetric-but-unconfigured. **No provider in this codebase returns a calibrated confidence score for vision output** — this is the load-bearing constraint on Feature Area 6 (Intelligence Confidence Layer) and Feature Area 1's confidence request. A real per-field statistical confidence (the kind a dedicated OCR engine like Tesseract or Cloud Vision produces) does not exist here and building one would mean integrating an entirely different, non-LLM technology — out of scope, per v1's own established reasoning. What's genuinely available: asking the vision model to **self-report** a confidence estimate for what it extracted, as part of its own response. This is a real, commonly-used technique — not fabrication — provided it is honestly labeled as the model's own self-assessment, not a calibrated statistical guarantee. v2 adopts this, with explicit "self-reported" framing everywhere it's surfaced (matching this codebase's existing "no fake intelligence" discipline).

## 6. Metadata storage patterns

Confirmed: `assets.metadata` (jsonb, v1) is the right place for confidence/language too — additive fields on the existing `AssetAnalysis` type, no new column. `extraction_metadata.metadata` (documents) has the identical shape for `documentIntelligence` — v2's asset-side `documentIntelligence` field goes into `assets.metadata.documentIntelligence`, mirroring the document side exactly.

## 7. Existing AI orchestration layer

Confirmed reusable, unchanged: `streamChatCompletion`, `runCapability`, `withProviderAvailability`, `runWithFallback`, `useProviderChain`. No new orchestration primitive is needed for anything in v2's scope.

## 8. Search architecture (new to this phase's scope: "OCR output must become searchable knowledge")

Audited the existing per-source-type search pattern (`src/modules/search/`): each source (documents, conversations, notes) has its own `{source}_embeddings` table + a `match_{source}` Postgres RPC (semantic, HNSW cosine index) + a `{source}SearchProvider.ts` combining that with a lexical ILIKE fallback (`hybridScore.ts`'s `applyLexicalBoost`), registered once in `registerBuiltInProviders.ts`. `notesSearchProvider.ts`/`note_embeddings`/`match_notes` (`0025_note_search.sql`) is the closest template — notes and assets are both owned per-row (`user_id`/`owner_id` respectively) with an optional `workspace_id`. **Assets currently have zero presence in Universal Search** — confirmed by grep, no `asset_embeddings` table, no `assetSearchProvider`. This is the concrete, well-precedented way to satisfy Feature Area 1's explicit mandate ("OCR output must become searchable knowledge. Do not store OCR as dead text.") without inventing a new search mechanism.

## 9. What v2 should NOT build (extending v1's own deferral list)

- **A second intelligence engine per feature area.** The brief's structure (OCR Intelligence / Screenshot Intelligence / Spreadsheet Vision Intelligence / Handwritten Notes Intelligence) reads as four separate capabilities, but the underlying mechanism for all four is identical: one vision call (`analyzeImage`) producing text, optionally followed by the existing structured-extraction capability (`analyze-document-intelligence`) applied to that text. Building four separate prompts/parsers/capabilities for what is structurally one pipeline would be exactly the "duplicate intelligence engine" this phase's own instruction forbids. v2 therefore extends the *existing* `analyze-image` prompt to adapt its output to whatever content type is actually present (the model already does this naturally when asked to describe what it sees), rather than routing to different capabilities per image type.
- **Real per-character/calibrated OCR confidence.** See §5 — self-reported confidence, clearly labeled, is the honest version of this.
- **A dedicated Task entity** (with due dates, owners, reminders/notifications) as asked for by "Convert into ... Tasks." No such first-class object exists in this codebase (confirmed: `notes`/`knowledge_nodes` exist, nothing task-shaped does). Building one is a genuinely separate, larger product surface (a task list view, due-date reminders, notification plumbing) than this phase should take on unilaterally. v2's interpretation: tasks extracted from an image become part of a structured Note's content (a markdown checklist), using the Notes infrastructure that already exists — real, usable, honest about what it is.
- **Spreadsheet-screenshot table/formula reconstruction with the same rigor as the real `xlsx`/`csv` analyzer.** A vision call can describe a spreadsheet screenshot in prose (feeding the same knowledge-extraction chain as any other image) but cannot reliably reconstruct exact cell values or formulas from pixels the way the deterministic `workbookAnalysis.ts` engine does from real cell data. Presenting vision-derived spreadsheet "data" with the same confidence as the real analyzer would be dishonest. v2 does not attempt structured cell/formula extraction from spreadsheet screenshots.
- **Vision-grounded (bounding-box) diagram/whiteboard structural extraction.** Unchanged from v1's deferral — this architecture has no vision-grounding capability, only prose description.

## 10. Recommended v2 scope

1. Extend `analyzeImage`'s prompt/parser/type: detected language + self-reported confidence (`{text, entities, relationships}`), clearly labeled as AI self-assessment.
2. Generalize `runDocumentIntelligence` into `runDocumentIntelligenceFromContent`; apply it to an asset's analyzed text (dates/decisions/tasks), stored in `assets.metadata.documentIntelligence` — reuses the existing capability and parser verbatim.
3. Asset search: `asset_embeddings` + `match_assets` (new migration, mirroring `note_embeddings`/`match_notes`), `indexAsset.ts`, `assetSearchProvider.ts`, registered alongside the other three providers — closes the "must become searchable" mandate.
4. UI: surface language/confidence on `ImageReaderPage`, with a "needs review" banner when self-reported confidence is low; a "Convert to structured note" action rendering dates/decisions/tasks as a real Note (checklist for tasks), reusing existing note-creation/linking.
5. Tests for all new pure logic (parser extensions, structured-note builder) and the fallback-when-vision-unavailable path.

Explicitly deferred, with reasoning: per-feature-area duplicate capabilities, calibrated OCR confidence, a first-class Task entity, rigorous spreadsheet-screenshot table reconstruction, vision-grounded diagram structure extraction, functional Anthropic/Google vision (still a secrets-configuration gap, not code).
