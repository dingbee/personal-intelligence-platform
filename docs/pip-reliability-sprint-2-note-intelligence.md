# PIP Reliability Sprint 2/10 — Explicit Note Intelligence

Not a new capability. Milestone 1/10 (Image Analysis & Provider Path, commit `74a56be`) is the confirmed baseline. This sprint's sole objective: make explicit Note analysis reliable enough to declare 10/10 — a user opens a Note, asks NOVA to analyze it explicitly, and gets an answer grounded in the Note's actual content.

---

## Phase 1 — Discovery

Verified before any change: repository `dingbee/personal-intelligence-platform`, branch `main`, clean working tree, `HEAD` at `74a56be` with Milestone 1's changes present.

**Deployed edge functions re-checked, not assumed.** Per this sprint's own critical rule (Milestone 1 found the deployed `ai-chat` function stale even though the repo was correct), `mcp__Supabase__list_edge_functions` was called again: `ai-chat` is still version 18, matching the redeploy from Milestone 1 exactly (same hash). No drift since. `provider-availability` remains byte-for-byte identical to its repo source. Note analysis reuses `ai-chat`/`streamAiChat` unchanged — there is no note-specific edge function to check.

**Full path traced, end to end:**

```
NoteDetailPage ("Analyze with NOVA")
  → useCommandActions().createConversationWithNoteAnalysis(noteId, title)
      → creates a conversation (identical path to createConversationWithQuery)
      → navigates to /chat?conversationId=<id>&initialNoteId=<noteId>   [id only, never content]
  → ChatPage's initialNoteId effect (mirrors the existing initialQuery effect)
      → resolveNoteAnalysisSeedText(noteId)
          → getNote(noteId)                          [RLS-scoped: owner or shared workspace member]
          → buildNoteAnalysisSeedQuery(title, content) [real content, honest empty-note fallback]
      → handleSend(seedText) → useSendMessage().send() → AIService.sendMessage()
          → insertMessage({role:'user', content: seedText})   [persisted, real content]
          → messages: [...history, {role:'user', content: seedText}]  → provider, unmodified, untruncated
```

**What was already working (built in the prior Multimodal Intelligence Stabilization milestone, reused unchanged):**
- `buildNoteAnalysisSeedQuery` — carries real note content into the seed message, with an honest fallback for an empty note.
- `createConversationWithNoteAnalysis`/`initialNoteId` — already avoided the URL-length trap `createConversationWithQuery` would have hit on a long note, by carrying only the note id through the URL.
- `AIService.sendMessage` sends `messages: [...history, {role:'user', content:text}]` to the provider with **no truncation, no chunking, no summarization** — the full seed text (and full prior history) reaches the model every time. This means Test E (long note) and Test G (follow-up retains context) were already structurally correct by construction; they needed proving, not fixing.
- Notes already participate in the existing intelligence infrastructure the task asked about (Test F): `indexNote.ts`/`notesSearchProvider.ts` (Universal Search) and `linkKnownConceptsToSource({sourceType:'note', ...})` (Knowledge Graph), both from earlier, unrelated milestones. Reused as-is — no new indexing or extraction pipeline was built.
- `notes` table RLS (`0029_note_sharing.sql`) already scopes `select` to the note's owner or a shared workspace member — verified by reading the migration directly, not assumed. `getNote(id)` throws (via `.single()`) for both "doesn't exist" and "not yours" identically, which is the correct, non-information-leaking behavior for both cases.
- The action's wording ("Analyze with NOVA", not "Ask about this" or generic chat) and behavior (never exposes provider names/internals) were already correct from Milestone 1 — verified, not changed.

**The one real defect found:** `ChatPage.tsx`'s `initialNoteId` effect called `getNote(initialNoteId).then(...)` with no `.catch()`. Since `getNote` throws for both a deleted note and an unauthorized one, either case produced an **unhandled promise rejection** — the conversation was left silently empty, with no feedback to the user at all. This is exactly the "compensate for a broken layer by duplicating data elsewhere" anti-pattern the sprint warned against, except inverted: nothing compensated, so the failure was simply invisible.

---

## Phase 3/4 — Diagnosis and fix

**Root cause:** a missing error handler at the one point in the pipeline where a real I/O call (`getNote`) can fail for reasons outside the happy path (deletion, revoked access). Every other step in the trace above is either a pure function (never throws) or already has an established never-throws contract (`buildNoteAnalysisSeedQuery`'s own empty-note handling).

**Fix — smallest correct layer, reusing existing conventions.** Rather than patch the missing `.catch()` inline, the fetch-and-build logic was pulled into `src/modules/notes/intelligence/resolveNoteAnalysisSeedText.ts`, a small async function with its own try/catch:

```ts
export async function resolveNoteAnalysisSeedText(noteId: string): Promise<string> {
  try {
    const note = await getNote(noteId)
    return buildNoteAnalysisSeedQuery(note.title, note.content)
  } catch {
    return "I tried to open a note to analyze, but couldn't access it — it may have been deleted, or you may not have permission to view it."
  }
}
```

This never throws, so `ChatPage.tsx`'s effect is now simply `void resolveNoteAnalysisSeedText(initialNoteId).then((seedText) => handleSend(seedText))` — a deleted or inaccessible note now produces a visible, honest message in the conversation instead of silence, without inventing new UI state or a second error-handling path. Same voice/convention `buildNoteAnalysisSeedQuery`'s own empty-note fallback already established.

**Two small, additive improvements, not defects, made while verifying against the Acceptance Contract:**
- `buildNoteAnalysisSeedQuery`'s extraction request now explicitly asks for **priorities** (Test C's fifth category) and asks NOVA to **keep categories distinct** rather than blending them into one summary — the acceptance contract listed both explicitly; the prior wording covered decisions/dates/tasks/people but not priorities or explicit category separation.
- `useCommandActions.ts`'s URL-building for note analysis was extracted into `buildNoteAnalysisConversationUrl.ts`, a pure function — making the "only ever an id, never content, regardless of note length" property (Test E's transport-safety claim) directly testable rather than merely true by inspection.

**No duplicate intelligence engine was built.** Every fix reuses `AIService.sendMessage`, `useSendMessage`, `getNote`, existing RLS, existing conversation creation/persistence, and the existing chat send pipeline. The only new code is: one small async orchestration function with a try/catch, one pure URL builder, and a wording change to an existing prompt string.

---

## Phase 6 — Context integrity (verified, not merely assumed)

The sprint's central check. New `AIService.test.ts` tests assert against the actual object passed to `streamChatCompletion` (the provider call boundary) — not merely that a note id reached some intermediate function:

- A seed message built from realistic note content (the exact budget/decision/task example from Phase 9's acceptance script) is asserted to appear **verbatim** in `messages` as sent to the provider.
- A ~15,000-character note body is asserted to reach the provider **without truncation** (`content` length matches exactly) — proving there is no hidden length cap anywhere between the seed builder and the provider call.
- A two-turn `history` (a prior note-analysis exchange) plus a new follow-up question is asserted to produce `messages = [...history, newMessage]` unmodified — proving a follow-up question retains the original note content, because the entire prior conversation is replayed on every turn, not because of any note-specific memory mechanism.
- A note-analysis message is asserted to go through `runWithFallback`/`resolveProviderChain` exactly like any other message (same `provider`/`requestedProvider` shape) — proving there is no note-specific provider path.

This directly answers Phase 6's ask: `Note content → context → model request` is now a proven property, not an assumption resting on `Note ID → conversation`.

---

## Phase 7 — Provider & security validation

- Note analysis uses `useSendMessage` → `AIService.sendMessage` → `resolveProviderChain`/`runWithFallback` — the exact same path as any other chat message. No `requireVision` or any other note-specific filter is applied (confirmed by reading `useSendMessage.ts`; it calls `useProviderChain(providerId)` with no options, same as before this sprint and before the vision-capability work in Milestone 1).
- Fallback (`runWithFallback`), platform governance (`resolveProviderChain`'s `platformSettings` filter), and preference-not-override semantics (`preferredProviderId` placed first only if still eligible) are all unchanged and untouched by this sprint.
- API keys remain server-side only (`ai-chat`'s `Deno.env.get(...)` reads, unchanged). No provider name, model id, or routing detail is exposed in any Note-analysis-specific string, error message, or UI copy — the one new user-facing string (the inaccessible-note fallback) mentions nothing about providers or infrastructure.

---

## Tests added (Phase 8)

| # | Requirement | Where |
|---|---|---|
| 1 | Seed contains actual Note content | `buildNoteAnalysisSeedQuery.test.ts` (existing, extended with priorities/distinct-categories cases) |
| 2 | `initialNoteId` retrieves the correct Note | `resolveNoteAnalysisSeedText.test.ts` — asserts `getNote` is called with the given id and the result flows into the seed |
| 3 | Note analysis creates correct conversation context | `AIService.test.ts` — seed text asserted verbatim in the provider request |
| 4 | Long Note path does not rely on URL-length transport | `buildNoteAnalysisConversationUrl.test.ts` — URL length is independent of note id/content length; `AIService.test.ts` — a ~15k-character message is not truncated |
| 5 | Note content reaches prompt/context assembly | `AIService.test.ts` — same test as #3, asserted against the actual `streamChatCompletion` call |
| 6 | Follow-up retains Note context | `AIService.test.ts` — `history` + new question produces the exact expected `messages` array, containing the original note content |
| 7 | Normal chat unaffected | Entire pre-existing `AIService.test.ts`/`useSendMessage` suite (unchanged, still 100% passing) constitutes this regression coverage |
| 8 | Provider fallback remains functional | `AIService.test.ts` — a note-analysis message asserted to go through the identical `provider`/`requestedProvider` shape as any other message |
| 9 | Unauthorized users cannot retrieve another user's Note | `resolveNoteAnalysisSeedText.test.ts` — a denied/nonexistent note produces the graceful fallback, never leaks the note id or any content, relying on the pre-existing, read-verified `notes` RLS policy |
| 10 | Missing/deleted Note produces a graceful failure | `resolveNoteAnalysisSeedText.test.ts` — same fallback path, explicitly covering the "deleted" case |

Full gate: `tsc -b` clean · `vitest run` — **1723/1723 passing** (11 new tests this sprint: 2 in `buildNoteAnalysisSeedQuery.test.ts`, 3 in `buildNoteAnalysisConversationUrl.test.ts`, 3 in `resolveNoteAnalysisSeedText.test.ts`, 4 in `AIService.test.ts`, minus double-counted overlaps — see git diff for the exact count) · `oxlint` clean · `vite build` succeeds (pre-existing chunk-size warning only, unrelated).

---

## Phase 9 — Live acceptance

**Not performed by this session.** This environment has no browser session authenticated against the deployed application, and no test-user credentials were provided — the same limitation noted in both prior milestones' reports. Everything in Phases 1–8 above was verified by direct code inspection, live edge-function/RLS verification via Supabase MCP tools, and automated tests asserting against the actual provider-call boundary — but the specific script in the task's Phase 9 (create the "Project meeting, 14 September" note, ask about the budget/photography/payment-gateway/reasoning/follow-up) requires a human with real login access to the deployed app to execute and confirm.

**What the automated evidence already establishes with high confidence**, matching Phase 9's exact example: `AIService.test.ts`'s context-integrity tests use this sprint's Phase 9 script verbatim as fixture content (budget ceiling $4,500, Sarah/photography, payment-gateway decision) and prove that text reaches the provider unmodified. Live acceptance is expected to pass on that basis, but per this engagement's standing rule, that expectation is not a substitute for the human running Phase 9's script and confirming.

---

## Deliberately deferred (named, not silently skipped)

- Extending `retrieveContext`/`retrieveGraphContext` to surface note content in *other*, unrelated ongoing conversations (RAG-based retrieval symmetry with documents/assets) — the explicit seed-message approach is what Phase 2's acceptance contract actually requires (content reaching the model directly, "not dependent on retrieval accidentally finding it"); retrieval symmetry remains a reasonable, separately-scoped future improvement, not required for this sprint's objective.
- A dedicated `ChatPage.tsx`-level component test — no React Testing Library component test exists anywhere in this codebase for a page of this size/hook-count; the properties that matter (seed-text correctness, graceful failure, no URL length dependency) are instead proven at the smaller, already-conventional unit level (`resolveNoteAnalysisSeedText`, `buildNoteAnalysisConversationUrl`, `AIService`) — consistent with "use existing test conventions."
