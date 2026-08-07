# Multimodal Intelligence v1 — Discovery Report

Read-only audit performed before implementation, per this phase's own instruction, using two grounded investigations: existing ingestion (documents, assets, spreadsheets, Knowledge Exchange) and existing intelligence/AI-runtime wiring (knowledge extraction chain, Hub/recommendations, memory, provider capabilities).

**The single most important finding:** this phase is not primarily a "wire images into existing pipelines" task. It is that, for text-bearing content — but for anything that requires actually *looking at* an image (OCR, screenshots, diagrams, handwritten notes), **no AI provider integration in this codebase can accept image input at all today.** Every registered `ChatProvider`'s message type is `content: string`; the edge function that proxies to Anthropic/OpenAI/Google sends that string straight through. This is confirmed by explicit design-comment disclaimers already in the code (`ImageCard.tsx`, `ImageReaderPage.tsx`: "no vision/OCR this phase — NOVA must not claim it can see the picture"). This reframes the whole task's scope: most of the original brief's 12 phases are blocked on one real, non-trivial architecture extension (Phase 2 below), not on wiring effort.

## 1. What already exists

**Document pipeline (text-bearing files) — solid, generic, reusable.** Upload → `documents` row → `processDocument.ts` orchestrates `extract → saveExtractionMetadata → chunk → embed → ready`. Type-specific extractors (`pdf`/`epub`/`docx`/`txt`/`markdown`/`xlsx`/`csv`/`ods`) all return one shared `ExtractionResult` shape. Chunking is generic across file types (chapter-aware if chapters exist, else paragraph — file type is never consulted). `document_chunks`/`embeddings` are the canonical RAG substrate.

**Spreadsheet Intelligence — already real, already understands meaning, not just cells.** `workbookAnalysis.ts` composes column-type/meaning detection, trend/anomaly detection (stddev-based), and financial-pattern classification (income-statement/expense-sheet/etc.), all deterministic, all persisted into `extraction_metadata.metadata.spreadsheet`. Phase 6's brief ("Revenue increased 20%, but profitability declined...") describes exactly what this already produces. No new work needed here — Phase 6 is effectively done, prior to this task.

**Knowledge extraction chain — the correct reuse target for Phase 8.** `runKnowledgeExtraction` (`src/modules/knowledge-intelligence/api/knowledgeExtraction.ts`) takes plain text + a caller-supplied `sourceType`/`sourceId`, runs three capabilities (`extract-concepts`/`extract-entities`/`detect-relationships`), and persists via `upsertKnowledgeNodes`/`upsertKnowledgeEdges`. The polymorphic `source_type`/`source_id` convention (`knowledge_nodes`, `knowledge_node_sources`, `knowledge_links` — "enforced in application code, not the database") means this chain already accepts any source, structurally, with zero schema change. It's currently only ever called with `sourceType: 'document'`.

**Assets (images) — complete file-management, zero content understanding.** Upload/validate/compress/derive (original/optimized/thumbnail)/store/tag/rename/view via signed URL, all solid. `assets` table has no jsonb metadata column at all (unlike `extraction_metadata`, which has one for exactly this kind of type-specific data) and is not wired into `document_chunks`/`embeddings`/knowledge extraction/Hub/recommendations in any way. The `0022_assets.sql` migration's own header names this explicitly as future work: "underneath future OCR/embedding/knowledge-graph/vision-agent work, none of which is in scope here."

**Knowledge Exchange packages — a proven, reusable pattern** (`src/modules/knowledge-exchange/{documents,assets,conversations,...}/`), each following the same manifest+validate+export+import quartet. Any new multimodal artifact type should follow this, not invent new plumbing.

**Provider architecture — server-mediated, one edge function, one real API key.** `supabase/functions/ai-chat/index.ts` is the *only* place provider API keys are read (Deno secrets, never client-bundled). It supports `anthropic`/`openai`/`google`, but **only `OPENAI_API_KEY` is actually configured as a secret in this deployment** (per `registry.ts`'s own comment — this is why `openai` is `DEFAULT_CHAT_PROVIDER_ID`, not `anthropic`). Anthropic/Google remain selectable in the UI but fail at request time without their secrets.

## 2. Gaps

- **No provider path can send image content.** `ChatProviderMessage { role, content: string }` (`src/modules/ai/providers/ChatProvider.ts`) and the edge function's mirrored `ChatMessage` type are both plain strings — not `string | ContentPart[]`. This blocks true OCR, screenshot analysis, diagram understanding, and handwritten-note conversion categorically, not just as an unwired feature.
- **No jsonb metadata column on `assets`** — nowhere to honestly persist AI-generated image analysis (description, extracted visible text, timestamp) without a schema change.
- **Assets are invisible to Hub and the recommendation engine** — `ComputeWorkspaceIntelligenceInput` and `GenerateRecommendationsInput` both take documents/notes/conversations/knowledgeNodes, never assets.
- **No dedicated OCR engine** (Tesseract, cloud OCR API) is integrated, and none is planned by this discovery — see §6. A vision-capable LLM call can produce a text transcription and a description, but not the per-character confidence score or layout bounding boxes the original brief's Phase 4 describes; those require a genuinely different (dedicated OCR) technology, not a wiring gap.
- **The memory system's `source` field is a flat string**, not the polymorphic `source_type`/`source_id` pair `knowledge_nodes` uses — there's no clean convention today for a memory to reference an asset (unlike knowledge nodes, which already generalize cleanly).

## 3. Recommended architecture

No new parallel intelligence engine, no new module tree beyond a couple of small, focused additions. Concretely:

1. **Extend `ChatProviderMessage.content`** to `string | ContentPart[]` where `ContentPart = { type: 'text', text: string } | { type: 'image', dataUrl: string }`. Extend the edge function's `ChatMessage`/content-building logic to translate `ContentPart[]` into each provider's real wire format (OpenAI `image_url` content parts, Anthropic `image`/`source.base64` blocks, Google `inlineData` parts) — additive, backward compatible (a plain string still works everywhere, since every existing call site never changes). This is the one genuine piece of new AI-runtime infrastructure this phase needs; everything else is composition over it.
2. **One new "analyze-image" capability**, registered the same way `generate-conversation-title`/knowledge-extraction capabilities are, given an asset's signed URL as a `ContentPart[]` message. Output: a plain-language description plus any literal visible text — framed honestly as AI-generated interpretation, never as calibrated OCR with a confidence percentage.
3. **`assets.metadata jsonb`** (new additive column, migration `0038`) to persist that output, mirroring `extraction_metadata.metadata`'s existing pattern for other type-specific data.
4. **Feed the analysis output into the existing `runKnowledgeExtraction` chain**, with `sourceType: 'asset'`, `sourceId: asset.id` — Phase 8 ("visual knowledge extraction") becomes a consequence of reuse, not a new system. This is the one place §2's polymorphic-`source_type` finding pays off directly.
5. **One UI entry point** ("Analyze with NOVA") on the existing `ImageCard`/`ImageReaderPage`, reusing the same button/action pattern those pages already use for "Ask NOVA."
6. **Document Intelligence v1** (classification + structured entity/date/decision/task extraction) is orthogonal to all of the above — it's a pure text capability over content the pipeline already extracts, needs zero provider changes, and should ship regardless of the vision work's outcome.

## 4. Risks

- **Only OpenAI is functional in this deployment.** The image-content extension will be built symmetrically for all three providers (so it's not a one-off hack), but only the OpenAI path is actually end-to-end testable here, since `ANTHROPIC_API_KEY`/`GOOGLE_API_KEY` are not configured secrets. This mirrors the existing text-chat situation exactly (same registry comment) — not a new risk this phase introduces, but worth naming so "vision works" isn't read as "vision works on every provider."
- **Honesty risk on "OCR."** The brief's Phase 4 asks for extracted text + a confidence score + layout information — a real OCR-engine feature set. A vision-LLM call can produce a text transcription, but not a calibrated per-character/per-word confidence score (the model doesn't expose one), and not structured layout/bounding-box data. Building a UI or storage schema that implies OCR-grade guarantees, when the real behavior is "a language model's best-effort description of what it sees," would be exactly the "no fake intelligence" violation this project's own AI Experience Intelligence phase explicitly guarded against. v1 stores and presents this as AI-generated interpretation, not OCR output.
- **Cost/latency**: vision calls are more expensive and slower than text-only completions on most providers. Analysis should be an explicit, user-triggered action (matching the brief's own "Analyze with NOVA" framing), never automatic on every upload.
- **Prompt-injection surface**: text extracted from an image (e.g., a screenshot containing instructions) flows into the same knowledge-extraction/memory pipeline as any other text. No new risk beyond what already exists for document text — the same capability boundaries (no tool execution from extracted content) apply.

## 5. Migration requirements

One additive migration, `0038_asset_metadata.sql`: `alter table public.assets add column metadata jsonb;` — nullable, no backfill, no RLS change (existing asset RLS already covers the new column). No changes to `document_chunks`, `embeddings`, or any RLS policy elsewhere. No destructive SQL.

## 6. Explicitly out of scope for v1, with reasoning

- **Dedicated OCR** (Tesseract/cloud OCR API integration) with per-character confidence and layout/bounding-box output — a materially different technology stack from "call a vision-capable chat model," and not something this phase should silently substitute a lesser capability for and call the same name (see §4's honesty risk).
- **Handwritten notes → structured project/task/deadline conversion** (original brief Phase 7) — this needs real task/project entities with owners and deadlines, which don't exist as first-class objects in this app yet (only notes and knowledge nodes do); building that entity model in the same pass as multimodal ingestion is a separate, larger scope decision.
- **Spreadsheet screenshots** — chains two speculative capabilities (vision-based text extraction, then spreadsheet-structure inference from that text) rather than reusing the existing, real `xlsx`/`csv` extractor; a genuinely harder, lower-confidence problem than either capability alone.
- **Diagram/whiteboard *structural* relationship extraction** (boxes, arrows, explicit graph topology) — the general-purpose "analyze-image" capability will describe a diagram's content in prose (feeding the same knowledge-extraction chain as any other text), but extracting a structured, vision-grounded node/edge graph directly from pixel coordinates is a different, harder capability this single vision-call design doesn't provide.
- **A unified cross-surface "Upload anything" UX** (original brief Phase 9) — this phase adds one entry point (Images tab / `ImageReaderPage`), not a new upload surface reachable from Chat attachments, Reader, and Knowledge Explorer simultaneously; each of those is its own integration surface with its own UX considerations.
- **Extending Anthropic/Google to be functionally vision-capable in this deployment** — the type/edge-function extension is built symmetrically, but making those two providers actually usable requires configuring their API secrets, which is an operational/deployment change outside this phase's code scope.
- **Agentic features** — explicitly excluded by this phase's own final instruction.

## 7. Recommended v1 scope

1. Provider content-block extension (foundation for everything image-related).
2. `assets.metadata` migration.
3. `analyze-image` capability + API + hook, honestly framed.
4. Wire the analysis output into the existing `runKnowledgeExtraction` chain via `sourceType: 'asset'`.
5. "Analyze with NOVA" UI entry point on `ImageCard`/`ImageReaderPage`.
6. Document Intelligence v1 (classification + structured entity/date/decision/task extraction) — independent of the above, ships regardless.
