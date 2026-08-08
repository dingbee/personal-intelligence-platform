# PIP Multimodal Intelligence Stabilization v1

Not a new intelligence capability. Full discovery in `docs/pip-multimodal-intelligence-stabilization-v1-discovery.md` — this document covers what was fixed, why, and what remains.

---

## What was fixed

### Problem 1 & 2 — Image analysis "Provider unavailable" / PIP not reliably seeing images

**Root cause:** the live `ai-chat` Supabase Edge Function was running a stale build (v17) that predated all multimodal (`ChatContentPart[]`) support already present in the repository's own source. Client-side provider resolution for image analysis (`useAnalyzeImage` → `useProviderChain` → `resolveProviderChain`) is — and always was — identical to normal chat's resolution; the two paths diverged only once a request reached the deployed function, which had no translator for image content and forwarded the client's internal `{type:'image', imageUrl}` shape straight through instead of OpenAI's/Anthropic's/Google's real wire format.

**Fix — redeploy, not rewrite.** `supabase/functions/ai-chat/index.ts`'s current repo source was deployed as-is via `mcp__Supabase__deploy_edge_function` (now version 18). No application code changed for this half of the fix — the correct implementation already existed and simply wasn't live.

**Additive hardening — explicit vision capability.** Even though the deployment gap was the actual cause, the milestone's own audit checklist explicitly asked whether "any distinction between chat and vision capabilities" existed — it did not. Added one, small and additive:

- `AIProviderDescriptor` (`src/modules/core/providers/types.ts`) gained an optional `supportsVision?: boolean`. Omitted/undefined is treated as vision-capable (matching every provider registered today), so this is purely opt-in for excluding a future text-only provider.
- `coreModule.ts` declares `supportsVision: true` on all three registered chat providers, matching `ai-chat`'s own per-provider content-block builders exactly (all three really do support image input).
- `resolveProviderChain` (`src/modules/ai/router/resolveProviderChain.ts`) gained an optional `requireVision?: boolean` param — when set, filters candidacy to `supportsVision !== false`, on top of every existing filter (registry status, key availability, overrides, platform governance). Omitted, it's a no-op — every existing call site (chat, capabilities) is unaffected.
- `useProviderChain` (`src/modules/ai/router/useProviderChain.ts`) gained a matching optional `options.requireVision` passthrough.
- `useAnalyzeImage.ts` now calls `useProviderChain(providerId, { requireVision: true })`.

This has zero behavioral effect today (every registered provider is vision-capable), by design — it exists so a future text-only provider is excluded from image-analysis routing by construction, and so "no vision-capable provider is configured" is a real, distinct, already-wired failure mode rather than something that would need inventing later. Automatic routing, fallback, platform governance, and Pro-preference-as-preference (never a hard override) are all completely unchanged — `requireVision` only narrows candidacy, using the exact same precedence rule (`resolveProviderChain`) every other gate already goes through.

### Problem 3 — Notes cannot be reliably analyzed

**Root cause:** "Ask NOVA about this note" (`NoteDetailPage.tsx`) seeded a new conversation with only `I'd like to talk about a note called "<title>"` — the note's actual content never reached the model. No retrieval path (RAG, graph context, Universal Search) is wired into ongoing chat for notes either, so nothing else could have surfaced it.

**Fix — an explicit "Analyze with NOVA" action carrying real content**, mirroring the pattern the prior milestone already established for images (`buildImageChatSeedQuery`), but with one necessary difference: a note's content can be arbitrarily long ("substantial work"), and the existing `createConversationWithQuery` mechanism carries its seed text through a URL query parameter — unsafe for note-length content (see discovery §C). So instead of extending that mechanism, this adds a parallel one that only ever puts a note *id* in the URL:

- `src/modules/notes/intelligence/buildNoteAnalysisSeedQuery.ts` (new, pure) — builds the seed message from a note's real title + content, asking for main ideas, decisions, dates, tasks, and entities; honestly reports an empty note rather than fabricating something to analyze.
- `CommandActions` (`src/modules/commands/types.ts`) gained `createConversationWithNoteAnalysis(noteId, noteTitle)`, implemented in `useCommandActions.ts` — creates the conversation exactly like `createConversationWithQuery` does, but navigates with `?initialNoteId=<id>` instead of `?initialQuery=<text>`.
- `ChatPage.tsx` gained an `initialNoteId` effect mirroring the existing `initialQuery` effect exactly (same once-per-mount / only-into-an-empty-conversation guards) — it fetches the note (`getNote`) once mounted, builds the seed query, and sends it through the identical `handleSend` pipeline every other message goes through. No second AI pipeline.
- `NoteDetailPage.tsx`'s button is renamed "Analyze with NOVA" (matching the task's own suggested wording) and now calls `createConversationWithNoteAnalysis(note.id, note.title)`.

**Why no second note-intelligence engine was built.** This reuses the conversation-creation path, `AIService.sendMessage`, `useSendMessage`, and the existing chat UI end to end — the only new code is the seed-query builder (pure string formatting) and the id-instead-of-content URL handoff. Analysis, summarization, decision/date/task extraction all happen through the same model call every other chat message goes through; nothing about how NOVA reasons was duplicated.

**Deferred, not silently skipped:** extending `retrieveContext`/`retrieveGraphContext` to also surface note content in *other*, unrelated ongoing conversations (the same symmetry the P0 asset fix added in the prior milestone) — not required to resolve the reported symptom, and explicitly named as a follow-up in the discovery report rather than left unmentioned.

---

## Security

- No API key, provider internals, routing logic, or secret configuration was ever printed, logged to a client-visible surface, or exposed in any UI string, error message, or code comment.
- The `ai-chat` redeployment changed no secret handling — `Deno.env.get('OPENAI_API_KEY'/'ANTHROPIC_API_KEY'/'GOOGLE_API_KEY')` reads are unchanged from the source that had always been in the repo; only which version was actually running changed.
- `supportsVision` is ordinary, non-secret registry metadata (a boolean, same trust level as `label`/`models`), never sent anywhere it wasn't already — it doesn't appear in any new client-visible surface.
- Availability checks were not weakened anywhere — `requireVision` only ever narrows an already-computed eligible set further; it cannot make a previously-ineligible provider eligible.

---

## Testing

Automated:

- `resolveProviderChain.test.ts` — 5 new tests under a `requireVision` describe block: excludes a `supportsVision:false` provider; excludes it even when preferred (no hard override bypass); treats an omitted `supportsVision` as vision-capable (matching every provider registered today); is a complete no-op when `requireVision` is omitted; returns an empty chain when nothing vision-capable is eligible (the "clear user-safe error" case — still resolves to the existing, unchanged `PROVIDER_UNAVAILABLE_MESSAGE`, never a new bespoke string).
- `buildNoteAnalysisSeedQuery.test.ts` — 5 new tests: real content (not just title) reaches the seed message; the four required extraction targets (main ideas/decisions/dates/tasks) are all requested; an empty note gets an honest "it's empty" seed instead of a fabricated analysis prompt; whitespace-only content is treated as empty; surrounding whitespace is trimmed from real content.
- `planningCommands.test.ts` — updated two existing `CommandActions` test mocks to satisfy the now-required `createConversationWithNoteAnalysis` field (compile-time enforced; no behavior change to the commands under test).

Explicitly not covered by an automated test in this repository, consistent with existing precedent:

- The `ai-chat` Edge Function itself (Deno code under `supabase/functions/`) — same as every other edge function in this codebase, verified by deployment + manual QA, not vitest.
- `ChatPage.tsx`'s new `initialNoteId` effect — component-level React effects in this codebase are not unit-tested (the sibling `initialQuery` effect it mirrors has no test either); covered by the manual QA checklist below.

**Full verification gate:** `npx tsc -b` clean · `npx vitest run` — **1712/1712 tests passing** (0 failures — the pre-existing single-test flake noted in the prior milestone did not recur on this run) · `npx oxlint` clean · `npx vite build` succeeds (pre-existing chunk-size warnings only, unrelated to this milestone).

---

## Manual QA checklist

None of the following can be confirmed by an automated test in this repository — all require a live deployment and a real vision-capable provider request.

1. **MANUAL VERIFICATION REQUIRED** — Image test: upload a photograph containing handwritten notes, trigger "Analyze with NOVA," confirm no "Provider unavailable" error, confirm NOVA's description reflects the actual image, confirm extracted text is visible, confirm a follow-up question about the image is answered from real content.
2. **MANUAL VERIFICATION REQUIRED** — Screenshot test: upload a screenshot of a spreadsheet/table, ask "What does this table show?", confirm the answer reflects the actual visual contents (not a generic/hallucinated table).
3. **MANUAL VERIFICATION REQUIRED** — Handwritten test: upload a photo of rough planning notes, ask "Extract the tasks, dates and decisions," confirm the extracted items are genuinely present in the image.
4. **MANUAL VERIFICATION REQUIRED** — Note test: create a Note with substantial content, click "Analyze with NOVA," ask "What are the main ideas, decisions and next actions?", confirm NOVA's answer reflects the note's real content, not just its title.
5. **MANUAL VERIFICATION REQUIRED** — Note test with a genuinely long note (several thousand characters): confirm "Analyze with NOVA" still works correctly (this specifically exercises the `initialNoteId`-not-`initialQuery` fix — a regression here would look like a broken/truncated URL or a failed navigation).
6. **MANUAL VERIFICATION REQUIRED** — Chat regression: confirm normal chat (no image, no note) continues to work exactly as before, on all three flows (new conversation, existing conversation, Reader chat panel).
7. **MANUAL VERIFICATION REQUIRED** — Confirm the Founder Command Center / Settings provider controls still correctly enable/disable providers for both chat and image analysis (the `requireVision` filter is additive on top of these, never a replacement).
