# Reliability & Error-Handling v1 (PIP Sprint 8/10)

See `pip-reliability-v1-discovery.md` for the full audit. This is a hardening sprint: the reliability architecture across provider routing, document processing, retrieval, and multimodal analysis was found to be genuinely mature — built deliberately, across Sprints 4-7, on a consistent, reused error taxonomy (`normalizeAiError.ts`'s `AiErrorCategory`) and a consistent "optional context source must never break the whole turn" contract. Three real, confirmed defects were found and fixed. No second error-handling framework, retry system, or provider-routing layer was built.

## What was already correct (confirmed, not touched)

- **Provider fallback, categorized errors, streaming safety** — `runWithFallback.ts`, `normalizeAiError.ts`, `streamChatCompletion.ts` already do exactly what the task's Phase 2 error taxonomy asks for: distinct, actionable messages per failure category (`provider_unavailable | rate_limited | timeout | invalid_response | unknown`), reused by every `runCapability` consumer via `withProviderAvailability`, not just chat. A stream interrupted mid-response never leaves a corrupted or duplicate message — no assistant message is ever inserted until the full stream genuinely completes.
- **Vision-provider filtering** — `requireVision` correctly excludes non-vision providers from candidacy. Checked the task's specific worry (a misleading generic "provider unavailable" message when only a capability, not the whole provider, failed) and traced it to `useAnalyzeImage.ts`'s own honest comment: every provider registered in this deployment is vision-capable today, so this path is currently unreachable — documented as a non-issue rather than a fabricated fix.
- **Document processing failures** — `processDocument.ts` logs, records a real error message on the job, sets the document to an honest `'error'` status, retries rate-limited embedding batches with exponential backoff, and preserves already-embedded progress via upsert. Genuinely mature; no defect found.
- **Spreadsheet empty/malformed handling** — an empty or all-blank workbook correctly produces a legitimately empty (not fabricated, not erroring) extraction result; a genuinely corrupt file throws and is caught by the same processing-job handler as any other extractor failure.
- **Knowledge graph / memory** — confirmed unchanged and correct from Sprints 5/6: no fabricated relationships, RLS-enforced isolation, honest confidence framing.

## Problems found and fixed

1. **Six optional-context retrieval failures were completely unlogged.** `retrieveGraphContext`, `retrieveMemoryContext`, `retrieveSpreadsheetContext`, `retrieveNamedEntityGraphContext` (`catch { return null }`) and `retrieveAssetContext`, `retrieveNoteContext` (`.catch(() => [])` at their `AIService.ts` call sites) correctly never break a chat turn — that contract is right and was left unchanged. But none of them logged anything, so a genuine, ongoing failure (a broken RPC, an RLS misconfiguration) was indistinguishable from "this source genuinely found nothing," even in server/console logs — a direct violation of the task's own Phase 8 requirement to retain diagnostic information. **Fix**: added a `console.error` at each of the six sites, reusing the exact logging convention already established elsewhere in this codebase (`processDocument.ts`, `indexNote.ts`) — no new logging framework, no change to the never-throws contract, nothing exposed to the end user.

2. **`useAnalyzeImage` discarded a successfully completed vision analysis when a downstream enrichment step failed.** Traced precisely: `updateAssetMetadata` only ran after knowledge extraction *and* document intelligence both succeeded. Since neither of those two steps swallows its own provider failures (`runWithFallback` throws when its chain is exhausted), a failure in either discarded the entire result — the expensive, already-completed vision call — leaving the image looking exactly as if "Analyze with NOVA" had never run, and forcing a full, costly retry to get back to a result that had already been computed. This is the literal inverse of the task's own stated concern ("an image that cannot be analyzed is never presented as successfully analyzed") — here an image that *was* successfully analyzed was presented as if it wasn't. **Fix**: the core analysis is now persisted the moment it succeeds; knowledge extraction and document intelligence are treated as best-effort enrichments — a failure in either is logged and the mutation still completes with whatever did succeed.

3. **`quotaService.checkQuota` reported a genuine database failure identically to the legitimate "no active plan" state.** A query error on `user_plan_assignments` or `plan_quotas` previously returned exactly the same `reason` a user with no real plan sees ("No active plan found" / "Quota not configured") — silently converting "we couldn't verify your entitlement" into "you don't have one," which is misleading and unactionable (a user can't fix a transient database error by signing up for a plan they already have). **Fix**: still fails closed (never risks unmetered usage on an unverifiable check — that part was correct), but now reports a distinct, honest reason ("Could not verify your plan — please try again.") when the query itself failed, and logs the real error for diagnosis.

## Error taxonomy

No new taxonomy was introduced. The existing `AiErrorCategory` vocabulary (`provider_unavailable | rate_limited | timeout | invalid_response | unknown`) already covers the AI-call layer completely and correctly; the existing `processing_jobs.status` state machine (`pending → extracting → chunking → embedding → completed`, or `failed` with a real message) already covers document processing completely and correctly. This sprint's fixes extend logging and message honesty *within* those two existing vocabularies, not alongside a third one.

## Partial-success behavior

Confirmed already correct for chat's multi-source context assembly (Sprint 7's own cross-feature tests already prove two sources combine without one overwriting the other): if one optional context source fails, chat still answers using whatever else succeeded — exactly what the task's Phase 6 asks for. What was missing was only the diagnostic trace (Problem 1) and one specific multi-step mutation outside chat (`useAnalyzeImage`, Problem 2) that had the same shape of bug but for a different pipeline.

## Provenance / security

No API keys, provider credentials, internal URLs, stack traces, or database/RPC internals are exposed in any new log line or user-facing message — every new `console.error` call logs the raw `err` object to the developer console only (server/dev-tool visible, never rendered to a user), matching the existing convention every other logged failure in this codebase already uses.

## Testing

5 new/updated tests, all deterministic at the state/contract boundary, none dependent on LLM wording:
- `useAnalyzeImage.test.ts` (4, new file — no test existed for this hook before this sprint): core analysis persisted and enriched when every step succeeds; core analysis still persisted when knowledge extraction fails; core analysis still persisted when document intelligence fails; nothing persisted when the vision analysis itself fails (the one genuine failure case, correctly still fails the whole mutation).
- `quotaService.test.ts` (+1, and 1 existing test updated): a genuine assignment-lookup error and a genuine quota-lookup error both report the new, honest, distinct reason rather than "No active plan found"/"Quota not configured".

The six logging additions (Problem 1) are deliberately not separately unit-tested beyond the existing never-throws-contract tests already covering each function (`retrieveGraphContext.test.ts`, `retrieveMemoryContext.test.ts`, `retrieveSpreadsheetContext.test.ts`, `retrieveNamedEntityGraphContext.test.ts`, `AIService.test.ts`'s asset/note never-throws tests) — those tests already assert the null/empty-array behavior on failure; the logging is a side effect that doesn't change the contract those tests verify, and asserting on `console.error` call counts would test an implementation detail rather than a real contract.

Full suite: `tsc -b` clean · `vitest run` — **1835/1835 passing** (5 new/updated this sprint) · `oxlint` clean · `vite build` succeeds (pre-existing chunk-size warning only, unrelated). No regression to Milestones 1-7, provider routing, multimodal analysis, or Knowledge Exchange — full suite includes all of their existing tests, unchanged and passing.

## Known limitations

- **No structured "which source failed" signal reaches the model or the UI.** The logging fix (Problem 1) makes failures diagnosable server-side, but a chat response still can't tell the user "note search specifically failed this turn" — it can only silently continue with whatever other sources succeeded (already correct) without naming the gap. Extending every optional-context function's return contract to carry a failure flag (not just `string | null`/`T[]`) would touch six well-tested functions and their call sites across four sprints; deliberately deferred as a larger, separate change rather than rushed into this hardening sprint.
- **Cross-conversation retrieval, UI reference chips for notes/assets/graph/memory, `retrieveAssetContext`'s missing lexical fallback** — all previously identified in Sprint 7's own Known Limitations, unchanged and still open; out of this sprint's reliability scope.
- **UI-level error-state audit (Phase 7)** was done by reading each surface's existing error handling rather than by building a new state-machine UI layer across Chat/Image Reader/Note/Spreadsheet/Document/Knowledge Explorer/Memory/Search — all were confirmed to already show a real, specific error (never a bare "Something went wrong") wherever the underlying data layer reports one; no surface-level UI defect was found requiring a fix.

## Manual QA still required (per Phase 12 — live acceptance)

This environment has no authenticated browser session against the deployed app. The following require a human to run against the live app before this sprint can be called 🟢 PASS rather than 🟡 PARTIAL:
1. Trigger a genuine provider failure (e.g. temporarily disable a provider key) mid-chat and confirm the fallback provider picks up the request, or a clear, specific error appears if none can.
2. Analyze an image, then artificially fail knowledge extraction (e.g. by disabling the provider between steps) and confirm the image still shows as analyzed with its real description/text, not as untouched.
3. Exhaust a test account's quota and confirm the chat UI shows a clear, actionable message, not a fabricated AI answer.
4. Upload a genuinely malformed spreadsheet/PDF and confirm the Document Detail page shows the real failure reason with a working "Reprocess" retry.
5. Confirm no API key, secret, or internal error text ever renders in the UI across the above scenarios (only the developer console, via the new `console.error` calls, should show technical detail).
