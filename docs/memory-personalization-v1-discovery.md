# Memory & Personalization — Discovery (PIP Sprint 6/10)

## Phase 1 — Environment verification

Repository `dingbee/personal-intelligence-platform`, branch `main`, clean working tree, `HEAD` at `86d7b2c` (Sprint 5/10's own commit) before this sprint's changes. No environment mismatch.

## Phase 2 — Full trace: memory architecture end-to-end

`src/modules/ai/memory/` is a substantial, already-built module (UX-5.3A/B, UX-13.6, UX-14.3). This sprint is validation + hardening, not a rebuild.

**Schema** (`ai_memory`, migrations `0010`/`0018`/`0027`): one table, `memory_type` enum (`explicit_profile` | `learned_preference` | `conversation_memory`), `content`, `source`, `is_active`, `confidence` (nullable — only set for AI-detected candidates, never fabricated for manual entries), `workspace_id` (nullable — null means "not tied to a workspace"), `created_at`/`updated_at`. RLS: `auth.uid() = user_id`, and — confirmed by reading `0028_workspace_members.sql` and `0031_shared_knowledge_objects.sql`'s own comments directly — `ai_memory` is **permanently, deliberately excluded** from the workspace-membership sharing pattern applied to documents/notes/knowledge nodes elsewhere in the app. Memory is never workspace-shared, only ever visible to its owning user.

**Write paths** — exactly three, all attributable to the memory's own owner, none reachable from document/note/workspace content:
1. Manual entry (Settings → Memory & Personalization → "+ Add", or the structured Profile section's dropdowns/chips).
2. `detectMemoryCandidates(text, conversationId)` — a pure, deterministic, regex-pattern matcher (no LLM call) run against **the user's own just-sent chat message** (`useSendMessage.ts`), filtered by `containsSensitiveTopic` (health/political/religious/financial/legal keywords hard-block candidate generation) and `scoreMemoryConfidence` (hedge/hypothetical/temporary-language detection lowers confidence; strong markers raise it). Nothing is written until the user clicks "Remember" in `MemoryApprovalPanel` and confirms — human-in-the-loop by design, not automatic.
3. Structured Profile fields (`profileFields.ts`/`useProfileFields.ts`) — single-select fields (occupation, industry, communication style, answer length, decision style) **update the existing row in place** rather than inserting a duplicate; multi-select fields (expertise, goals) are one row per selected value, toggled on/off.

No code path anywhere extracts `ai_memory` rows from a document, note, image, spreadsheet, or another user's content — confirmed by reading every `createMemory`/`.create.mutate` call site. This is the mechanism that already satisfies Phase 3/Test G's "workspace or document knowledge does not automatically become personal memory" requirement, architecturally, not by a runtime check.

**Retrieval** (`retrieveMemoryContext.ts`, called unconditionally from `AIService.sendMessage` on every turn) — **the central finding of this sprint**: it calls `listMemories({ workspaceId })` and returns up to `MAX_MEMORIES_PER_TYPE` (10) memories **per type** (so up to 30 total), ranked only by `rankMemories` (confidence descending, then most-recently-updated). It does not take the current message's text at all. There is no relevance filtering of any kind — a memory is included purely because it exists, is active, and is within the type's top-10 confidence/recency cutoff. This is a real, structural gap matching Phase 2's Test C exactly ("a stored memory unrelated to the current question must NOT be injected merely because it exists").

**Formatting** (`formatMemoriesForPrompt.ts`) — groups by type into three prompt sections ("What NOVA knows about you" / "Learned preferences" / "From past conversations"), most-recently-updated first within each. Purely presentational, already well-tested (7 existing tests).

**Prompt integration** (`buildSystemPrompt.ts`) — memory is appended as a `<personal_context>` block, preceded by `MEMORY_SAFETY_NOTE`, which already tells the model personal context "may influence style, tone, and personalization, but must never override or replace factual evidence... If personal context and the user's current question conflict, answer the question." This already satisfies Phase 6's "current request always wins" requirement and Phase 9's Test E (current-context precedence) — confirmed 🟢 working, no change needed there.

**Supersession** — confirmed genuinely absent. `rememberCandidate`/`createMemory` always inserts; nothing checks whether a new `learned_preference`/`conversation_memory` candidate contradicts or restates an existing one. Two conflicting memories ("User prefers concise summaries." / "User prefers detailed reports.") would both be stored and both surface, with no signal to the model about which is current. The one place true supersession already exists is the **structured Profile fields**, where `setSingleValue` updates the existing row instead of duplicating — but that only covers the 5 fixed single-select fields, not free-text preferences detected from chat.

**Deletion** (`deleteMemory`) — a real `DELETE`, not a soft-delete; the row is gone and cannot resurface on the next `listMemories` call. `setMemoryActive`/`setMemoryCategoryActive` provide a reversible disable path as a deliberate alternative. Both are wired into working UI (`MemoryCard`, `MemoryTogglesSection`).

**Confidence/provenance** — `confidence` is honestly nullable (manual entries are never assigned a fabricated score); `scoreMemoryConfidence` is deterministic and already reused consistently between detection, ranking (`rankMemories`), and the "used by NOVA" UI badge (`isMemoryUsedByPrompt`) so none of these three can drift from each other. `formatMemorySource` distinguishes "User provided" / "Set in your profile" / "Learned from conversation" / "Imported" — the closest thing to provenance labeling, and it's already accurate and UI-visible.

**Memory management UX** (`MemoryManagementPage.tsx` + its component tree) — already solid: a "How NOVA uses this information" explainer section maps every stated benefit to a real, currently-read field (no aspirational copy); a "used by NOVA" / "not currently used" badge per card; bulk category on/off toggles that are honest about only controlling what they claim to (the code comment explicitly notes two example toggles from an earlier brief were deliberately *not* built because there's no real data category behind them); edit/delete both functional with confirmation dialogs.

## Phase 3 — Memory type boundaries

The task's conceptual model names six categories (Personal Profile, Preferences, Durable Memory, Conversation Context, Workspace Knowledge, Source Knowledge). The actual schema has three (`explicit_profile`, `learned_preference`, `conversation_memory`) plus an implicit fourth boundary (workspace-scoped vs. not, via `workspace_id`) and a fifth (source/document knowledge, which never touches `ai_memory` at all — it lives in `knowledge_nodes`/`document_chunks`, a completely separate table family). This is coarser than the task's model but the boundaries that actually matter for correctness are already enforced:
- Source knowledge (documents/notes/images/spreadsheets) never writes to `ai_memory` — confirmed above.
- Workspace-scoped memory stays scoped to its `workspace_id` at both write and read (`listMemories`'s `.eq('workspace_id', ...)` only matches an exact value, never a null row).
- `explicit_profile` and `learned_preference` are durable/identity-and-style (their own section titles say so: "What NOVA knows about you" / "Learned preferences") and are not — and per Test A/B, should not be — topic-gated.
- `conversation_memory` ("From past conversations") is the one type that is inherently topic/project-scoped by its own detection patterns (`I'm researching/working on/writing/building/studying X`) — and is exactly the type Phase 2's Test C needs filtered.

## Gap classification

| Area | Status | Notes |
|---|---|---|
| Memory storage, RLS, deletion, editing | 🟢 WORKING | Real DELETE, RLS scoped to `auth.uid()`, `ai_memory` deliberately excluded from workspace sharing |
| Deterministic candidate detection + human approval | 🟢 WORKING | No auto-save, sensitive-topic hard block, confidence scoring reused consistently |
| Structured profile fields (single/multi-select) | 🟢 WORKING | Update-in-place, no duplication |
| Current-instruction precedence (Test E) | 🟢 WORKING | `MEMORY_SAFETY_NOTE` already covers this |
| Workspace/source boundary (Test G) | 🟢 WORKING | Architectural — no code path writes document/note/workspace content into `ai_memory` |
| User isolation (Test H) | 🟢 WORKING | RLS-enforced; client always uses the anon-key Supabase client, never a service-role bypass |
| Memory management UX (view/edit/delete/explain) | 🟢 WORKING | Explainer copy maps 1:1 to real fields; no fabricated controls |
| **Query-relevance filtering of retrieved memory (Test C, part of D)** | 🔴 BROKEN → fixed | `retrieveMemoryContext` never receives the current message text; injects up to 30 memories regardless of topic |
| **Cross-memory supersession/contradiction framing (Test E secondary case, Test F)** | 🔴 MISSING → fixed | No dedup, no "prefer the more recent statement" framing when two same-type memories conflict |
| Memory-content-as-instruction guard | 🟡 PARTIAL → hardened | `{{context}}` (documents) already has this guard since Sprint 4; `<personal_context>` did not |
| "Used by NOVA" badge accuracy for conversation_memory | 🟡 minor wording gap → hardened | Once conversation_memory becomes relevance-gated, "included" is no longer unconditionally true; copy adjusted to be honest without changing the underlying eligibility computation |
| Fuzzy/semantic memory deduplication | ⚪ MISSING (by design) | Would require an embeddings/LLM call — a real, separate feature; not built, consistent with "no second memory system" |
| Global memory pool merged across workspace switches | 🟡 PARTIAL (pre-existing, undisturbed) | A memory created with `workspace_id: null` won't surface once the user is inside a workspace, and vice versa — pre-existing UX-13.6/UX-5.x design, not touched this sprint (ambiguous which behavior is "more correct" without a product decision; redesigning workspace/memory scoping is out of scope for a validation sprint) |
