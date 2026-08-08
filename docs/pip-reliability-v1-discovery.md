# Reliability & Error-Handling — Discovery (PIP Sprint 8/10)

## Phase 1 — Environment verification

Repository `dingbee/personal-intelligence-platform`, branch `main`, clean working tree, `HEAD` at `1cea7b3` (Sprint 7/10's own commit, matching the task's stated baseline) before this sprint's changes. No environment mismatch.

## Phase 1 (continued) — Full reliability audit

This audit traced the actual runtime failure paths (not assumed from documentation) for every area the task named. Most of the architecture is already mature and deliberately built for reliability across Sprints 4-7 — this sprint found three genuine, confirmed defects rather than needing a wholesale rebuild.

### A. Provider failures — mostly already correct

- **Fallback** (`runWithFallback.ts`): tries each candidate in order, returns on first success, throws the last error only if every candidate failed. Correct, already tested.
- **Availability** (`resolveProviderChain.ts`/`useProviderChain.ts`): candidacy is `key configured AND not overridden-off AND platform-enabled AND (vision-capable if required)`. An empty chain is the one, explicit "nothing eligible" state — never silently defaults to "everything available."
- **Error taxonomy** (`normalizeAiError.ts`): already exactly the vocabulary the task's Phase 2 describes — `provider_unavailable | rate_limited | timeout | invalid_response | unknown` — each mapped to a specific, actionable, non-technical message. Reused by every `runCapability` consumer via `withProviderAvailability`, not just chat. This **is** the "one coherent reliability vocabulary" the task asks for; no second taxonomy was introduced.
- **Vision filtering**: `requireVision` correctly excludes non-vision providers from candidacy in `resolveProviderChain`. Checked whether an empty vision-chain would show the generic `PROVIDER_UNAVAILABLE_MESSAGE` misleadingly (Phase 4's specific worry) — traced to `useAnalyzeImage.ts`'s own code comment: every provider registered today is vision-capable, so this path is currently unreachable in this deployment, not a live defect. Documented, not fabricated as a fix.
- **Streaming**: `streamChatCompletion.ts` — a mid-stream failure is logged to `ai_requests` (status: 'error') and re-thrown; the partial `accumulated` text is discarded, never persisted as a fake complete message. `useSendMessage.ts`'s `finally { setStreamingText(null) }` clears the UI's in-progress bubble on any outcome. No assistant message is ever inserted into `messages` unless the full stream actually completed — confirmed no duplicate/corrupted history is possible on interruption.
- **Quota** (`quotaService.ts`): `consumeQuota` throws on RPC failure, "so a successful AI response is never silently unmetered" (existing test's own words) — correct fail-closed design. **`checkQuota` has a real gap — see Problem 3 below.**

### B. Retrieval failures — the never-throws contract is deliberate and correct, but currently unobservable

Every optional chat-context source (`retrieveGraphContext`, `retrieveNamedEntityGraphContext`, `retrieveMemoryContext`, `retrieveSpreadsheetContext` — internal `catch { return null }`; `retrieveAssetContext`, `retrieveNoteContext` — external `.catch(() => [])` at the `AIService.ts` call site) is built, across four sprints, on a consistent, well-reasoned contract: a missing/broken source must never break the whole chat turn. This is correct and **should not be undone**. `retrieveContext` (the primary document-chunk path) deliberately does *not* swallow its own embedding failure — a genuinely broken embedding pipeline still fails the turn honestly rather than silently answering from nothing, which is the right behavior for the one source every turn depends on.

**The gap**: none of the six swallow sites log anything. A real, ongoing failure in one optional source (a broken `match_notes` RPC, an RLS misconfiguration on `knowledge_nodes`, an embedding-provider outage affecting only one call) is currently **completely invisible** — not in the browser console, not in any server log — because the error is discarded before anyone ever inspects it. This is a direct, confirmed gap against Phase 8's own requirement: "verify that development/server logs retain enough diagnostic information to investigate failures." **See Problem 1.**

### C. Multimodal failures — one confirmed defect

`useAnalyzeImage.ts` composes three steps (vision analysis → knowledge extraction → document intelligence) and only persists the result (`updateAssetMetadata`) after all three succeed. The vision call is the expensive, valuable one; extraction and document intelligence are enrichments. Traced precisely: if extraction or document intelligence throws (and `runKnowledgeExtractionFromContent`/`runDocumentIntelligenceFromContent` do NOT swallow their own errors — `runWithFallback` throws when a chain is exhausted), the whole mutation fails, `updateAssetMetadata` never runs, and a real, successfully-completed vision analysis is discarded — the image is left looking exactly like it was never analyzed at all, and the user must pay for and re-run the entire vision call to get back to where they already were. This is the literal inverse of the task's own warning ("an image that cannot be analyzed is never presented as successfully analyzed") — here, an image that *was* successfully analyzed gets presented as if it wasn't. **See Problem 2.**

OCR/vision failure itself, unsupported/oversized/corrupted images, and partial-confidence results were all confirmed already handled correctly and honestly: `analyzeImage`'s own confidence fields are surfaced verbatim (never silently dropped), `buildAssetContextContent.ts` explicitly appends a caveat sentence when any confidence dimension is low ("the model was not fully confident about... say so if asked... rather than stating them as certain"), and assets with `metadata: null` are correctly treated as "nothing indexed yet," never fabricated content (confirmed in `retrieveAssetContext.ts`'s own comment, unchanged since Stabilization v1).

### D. Document failures — already correct, no defect found

`processDocument.ts` is genuinely mature reliability engineering: extraction/chunking/embedding failures are caught, logged (`console.error`), recorded on the processing job with the real error message, and the document status is set to `'error'` — never silently left in a stuck or misleading state. Embedding batches retry with exponential backoff specifically on rate-limit errors (`isRateLimitError`, reading the real upstream status out of the edge function's relabeled 502), and every already-embedded batch is preserved via `upsert`'s `onConflict` — a retry after partial progress never duplicates or loses work. "Reprocess" (`useReprocessDocument.ts`) lets a user retry once the underlying cause (e.g., a missing API key) is fixed. No malformed-PDF/empty-PDF-specific defect was found — a genuinely corrupt file throws inside the extractor and is caught by this same, already-correct outer handler.

### E. Spreadsheet failures — already correct, no defect found

`spreadsheet.ts`'s extractor never throws on empty/sparse data — an empty workbook, or a workbook whose every sheet is blank, correctly produces a legitimately empty `ExtractionResult` (zero chapters, zero words), not a fabricated one. This is the right answer to the task's own question ("distinguish no data from data exists but analysis failed"): no data really does mean no data here, and it's represented honestly rather than as an error. A genuinely malformed/corrupt workbook binary throws inside `XLSX.read`, caught by the same `processDocument.ts` handler as any other extractor. `analyzeSheet` (`workbookAnalysis.ts`) was read in full: it is purely defensive array/string logic with explicit `undefined`-cell handling and default column names for a missing header row — no realistic malformed-data throw path was found, so no speculative try/catch was added around it (the task's own instruction: don't invent failure handling for a failure mode that can't actually occur).

### F. Notes and memory — already correct, confirmed via Sprint 2/6's own prior work

Sprint 2/10 already fixed graceful failure on a missing/inaccessible note. Sprint 6/10 already confirmed RLS-enforced user isolation for memory and fixed memory relevance-filtering. Re-verified both are unchanged and still correct — no regression found. Stale/conflicting memory framing (the model is told to trust the more-recently-listed entry) is unchanged from Sprint 6.

### G. Knowledge graph — already correct, no defect found

`retrieveGraphContext`/`retrieveNamedEntityGraphContext` never fabricate a relationship; a missing node or broken evidence lookup returns `null` (feeding into Problem 1's logging gap, but not a fabrication risk). Confidence framing (Sprint 5) already tells the model to present low-evidence relationships as "inferred, not directly corroborated" rather than fact.

## Phase 2 — Error taxonomy

The codebase already has a real, reused taxonomy — `normalizeAiError.ts`'s `AiErrorCategory` (`provider_unavailable | rate_limited | timeout | invalid_response | unknown`) for the AI-call layer, plus a separate, equally real state machine for document processing (`processing_jobs.status`: `pending → extracting → chunking → embedding → completed`, or `failed` with a real `error_message`). Both are reused consistently by every consumer that needs them (every `runCapability` caller for the first; `useReprocessDocument`/`ProcessingStatusBadge` for the second). No third taxonomy was introduced this sprint — the two gaps found (Problems 1 and 3) are fixed by extending logging/message-honesty within these existing vocabularies, not by adding a new one.

## Phase 3 — Failure propagation, summarized

```
UI → command/action → AIService → retrieval → context assembly → provider resolution → provider call → response
```

- Chunk retrieval failure (the one source every turn depends on): propagates honestly, fails the turn. Correct.
- Optional-source retrieval failure (notes/assets/graph/memory/spreadsheet): swallowed to `null`/`[]` by design (correct — must not break the turn), but currently **unlogged** (Problem 1).
- Provider-call failure: logged to `ai_requests`, normalized to a safe category+message, never silently dropped. Correct.
- Image-analysis multi-step failure: a later, non-essential step's failure currently discards an earlier, successful step's real result (Problem 2).
- Quota-check failure: a genuine database error is currently indistinguishable, in the message shown to the user, from the legitimate "you have no active plan" state (Problem 3).

## Gap classification

| Area | Status | Notes |
|---|---|---|
| Provider fallback, categorized errors, streaming interruption safety | 🟢 WORKING | Built across Sprints 7C/7D/8B/8C, re-confirmed unchanged |
| Vision-provider filtering | 🟢 WORKING | Correct by construction; currently unreachable in this deployment (documented, not fabricated) |
| Document processing failure handling | 🟢 WORKING | Logged, recorded, retryable, partial progress preserved |
| Spreadsheet empty/malformed handling | 🟢 WORKING | Empty data honestly represented as empty, not as failure or fabrication |
| Knowledge graph / memory never-fabricates-evidence | 🟢 WORKING | Confirmed unchanged from Sprints 5/6 |
| **Optional-context retrieval failures are unlogged** | 🔴 CONFIRMED → 🟢 FIXED | 6 swallow sites had zero diagnostic trace |
| **A successful image analysis can be discarded by an unrelated downstream failure** | 🔴 CONFIRMED → 🟢 FIXED | `useAnalyzeImage.ts` |
| **A genuine quota-check database error is reported identically to "no plan"** | 🔴 CONFIRMED → 🟢 FIXED | `quotaService.checkQuota` |
