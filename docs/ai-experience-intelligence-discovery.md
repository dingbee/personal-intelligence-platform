# AI Experience Intelligence v1 — Discovery Report

Read-only audit performed before implementation, per this phase's own instruction. Combines two rounds of grounded investigation: an initial pass over the memory/conversation/workspace/command surfaces, and a second, deeper pass specifically auditing `src/modules/intelligence/` and the Hub's data layer once it became clear the first pass had underestimated how much of this brief the codebase already implements.

**The single most important finding, confirmed by both rounds:** this is not a greenfield "add AI Experience Intelligence" task. A mature, already-wired intelligence pipeline exists — signals, attention, recommendations, resurfacing, all composed by one orchestrator into one `InteractionState`, feeding both Chat and the Hub. The task's own "do not create parallel intelligence systems" rule is therefore the dominant constraint on everything below: v1 is scoped to extend what exists and close the specific, verified gaps, not to build a second reasoning/memory/recommendation stack next to the ones already here.

## 1. Existing intelligence capabilities

- **Memory system** (Pillar 4 — Personalization): `ai_memory` table (`0010_reconcile_knowledge_tables.sql`) with `confidence` (`0027_ai_memory_confidence.sql`), `is_active`, three types (`explicit_profile`/`learned_preference`/`conversation_memory`). Deterministic regex-based candidate detection (`detectMemoryCandidates.ts`), user-approved (`MemoryApprovalPanel`), full review UI (`MemoryManagementPage`). Retrieval injects into every chat turn via `retrieveMemoryContext → formatMemoriesForPrompt → buildSystemPrompt`. A "Working Profile" (occupation, expertise, goals, communication style, preferred answer length) already exists as `explicit_profile` memory rows (`ProfileSection.tsx`/`profileFields.ts`), flowing through the same retrieval path — this is Pillar 4's own example, already shipped.
- **`src/modules/intelligence/`** (~30 files): a full pipeline. `signals/signalDetector.ts` → `IntelligenceSignal { type, message }` (self-documented as "informational only... nothing reads a signal and acts on it automatically"). `orchestrator/{attentionEngine,priorityEngine,resurfacingEngine,signalEngine,workspaceInsightEngine,decisionEngine,orchestrator}.ts` → `AttentionItem { type, message, priority: 'high'|'medium'|'low' }` (priority assigned per-type, e.g. `contradictory_memories` → high) and `WorkspaceInsight { type, label, value }`, both "never auto-acted-on" by their own doc comments. `recommendations/recommendationEngine.ts` → the single `Recommendation { category, command, reason }` shape every consumer (chat, dashboard) reads, the deliberate 2024 merge of two prior suggestion engines. `orchestrator/orchestrator.ts` composes all of it into one `InteractionState` (`context`, `references`, `evidence`, `suggestions`, `actions`, `attention`, `resurfacedKnowledge`, `workspace`, `signals`).
- **UX-12's reasoning modules** (Pillars 1 & 5 — Context Awareness, Intent Understanding): `intentClassifier.ts`/`planner.ts`/`contextSelector.ts` — fully deterministic, rule-based, display-only. `contextSelector.ts` documents itself as "a decision/observability layer, not a retrieval gate": it feeds the `ReasoningTrace` UI panel only, and never changes what's actually retrieved or injected into the prompt. This is the load-bearing constraint for any future context/intent work: extending this pipeline is correct; building a second one beside it is exactly the "parallel system" the task forbids.
- **Hub** (`src/modules/hub/`, powers `WorkspaceIntelligenceHubPage.tsx`): `computeWorkspaceIntelligence` → `IntelligenceItem { id, zone, title, description, href, timestamp, actionLabel }` across 5 zones (attention/active/organize/shared/learned), sorted by recency (no confidence/priority field). `computeWorkspaceHealth` → `WorkspaceHealthIndicator[]`, ratio-threshold based. "Continue Working" (`ContinueWorkingCard`, fed by `reading_progress`) is explicitly Pillar 3's own literal third example, already shipped. "Suggested Next Actions" (`RecommendedActionsSection`) reuses `generateRecommendations`.
- **Conversation titles** (Pillar 2 — Continuity): already fully built for `ChatPage` — `useGenerateConversationTitle.ts` invokes a real capability (`generate-conversation-title@1.0`) via `runCapability`/`withProviderAvailability`/`runWithFallback`, with a deterministic non-AI fallback (`titleGenerator.ts`) that never fails to produce a title. Gated on `messages.length === 0 && conversation?.title === 'New conversation'`.
- **Command intelligence**: the command palette (`filterCommands.ts`) does plain substring/prefix ranking. "Natural Language Knowledge Commands" and the Workspace Action Router (`workspace-actions/registry.ts`) are each one hand-written regex per feature, explicitly documented in-code as "not LLM intent classification."

## 2. Existing data sources

Confirmed available without any new persistence:

- **Conversations**: `updated_at`/`created_at`, `archived_at`, `is_pinned`, `favorite` (`database.ts:199-218`). `listConversations` sorts pinned-first, then `updated_at` desc. `messages.role`/`created_at` let "last message role" (unresolved-exchange detection) be computed on demand — not stored, but cheaply derivable.
- **Reading progress**: `reading_progress` table (`chapter_index`, `scroll_fraction`, `updated_at`, one row per document+user). `getMostRecentReadingProgress()` already backs "Continue Working."
- **Documents**: `status` enum (`uploaded`/`processing`/`ready`/`error`), `created_at`/`updated_at`. No "last opened"/"last viewed" tracking exists independent of `reading_progress` — confirmed by grep, not assumed.
- **Notes**: `updated_at`/`created_at`; provenance via the polymorphic `knowledge_links` table (`linkNoteToConversation`, `linkNoteToHighlight`, `linkNoteToAsset`, `linkNoteToMessage`, `linkNoteToMemory`).
- **`ai_requests`**: per-request rows (`provider`, `model`, `tokens`, `latency_ms`, `status`, `requested_provider`, `fallback_reason`, `created_at`), with an existing per-user aggregation layer (`listAiRequestsSince`, `aiHealthAggregation.ts` — provider/capability health, error intelligence, usage trends).
- **Search and command usage**: confirmed to **not exist** as persisted history/logs anywhere in the codebase (grep across `src/modules` for both). Search is stateless per request; the command palette has no usage tracking.

## 3. Existing reusable services/hooks

- `rankMemories` (this phase, item 1) — confidence-then-recency ranking, shared by the actual prompt-injection path and the "used by NOVA" UI badge so the two can never drift.
- `generateRecommendations({ scope, ... })` — the one recommendation engine; `scope: 'chat' | 'dashboard'` keeps genuinely different rule sets in one file rather than two files that could silently diverge.
- `computeWorkspaceIntelligence` / `computeWorkspaceHealth` — Hub's zone/health computation, reused unchanged.
- `useGenerateConversationTitle` — the one title-generation path (this phase wires it into Reader too, item 2).
- `buildResumeConversationCommand` — already used by `resurfacingEngine`'s chat-scope "related conversation" suggestion; reused unchanged for this phase's new dashboard-scope "unresolved conversation" recommendation (item 4).
- The registered-`capability` + prompt-template pattern (`runCapability`/`withProviderAvailability`/`runWithFallback`) — the proven mechanism for any future structured-AI-output need (titles, Generate Briefing); not invoked fresh by this phase's v1 scope, but the correct extension point for future work like conversation summaries.

## 4. Existing gaps

The one gap every part of this audit converges on: **no persistent dismissal exists anywhere for an AI-generated suggestion.** `dismissMemoryCandidate` is the only "dismiss" analog in the whole codebase, and it's in-memory-only (`useSendMessage.ts` — `setMemoryCandidates((c) => c.filter(...))`, no DB write). `workspace_objectives.status` includes a `'dismissed'` value, but that's a different feature entirely — a user-authored checklist item, explicitly documented as "not AI-generated." No `IntelligenceSignal`, `AttentionItem`, `Recommendation`, or `IntelligenceItem` has any way for a user to say "stop showing me this" that survives a page reload.

Two smaller, concrete gaps: `formatMemoriesForPrompt`/`isMemoryUsedByPrompt` ranked purely by recency, ignoring the `confidence` score the memory system has computed since `0027_ai_memory_confidence.sql` (fixed, item 1). Reader-originated conversations never got `ChatPage`'s auto-title treatment — `ReaderChatPanel.handleSend` never called `useGenerateConversationTitle` (fixed, item 2).

## 5. Opportunities

- Close the dismissal gap once, generically (item 3), and every existing proactive surface (Hub's attention/organize/shared/learned zones, dashboard recommendations) immediately becomes honestly "dismissible, non-annoying" as this task's Phase 3/6/7 require — without touching the underlying signal-generation logic at all.
- A genuinely new, evidence-backed signal is cheap to add on top of data the Hub already fetches: the most-recently-updated active conversation whose last message never got a reply (item 4) — the brief's own literal Pillar 3 example ("conversation with recent activity but no subsequent action"), computed with one additional query against data already in hand (`activeConversations`, capped at 5).
- Reader title parity (item 2) closes a real continuity gap with zero new capability — pure reuse of `useGenerateConversationTitle`.

## 6. What should NOT be built

- **A second intent classifier.** UX-12's `intentClassifier`/`contextSelector` already implement a deterministic version of Pillar 5. An LLM-based classifier added alongside it, rather than integrated through it, is precisely the "parallel intelligence system" this task's architecture section forbids. Future work should extend `contextSelector.ts` to actually gate retrieval (closing its own documented "not a retrieval gate" limitation), not add a second system.
- **Semantic conversation-to-conversation linking.** `resurfacingEngine`'s existing recency-based "related conversation" suggestion stays as-is. True topical linking needs embedding-based similarity search across conversations — a materially larger, riskier build (new indexing, new query patterns) than a "v1" pass should take on unilaterally.
- **Any automation/scheduled-execution layer.** Confirmed to not exist anywhere in the frontend. This phase's one new proactive signal is user-visible-and-dismissible, never autonomously executed.
- **New telemetry** for search history or command usage, to support "friction" signals from the original brief's momentum/friction taxonomy. Neither is persisted today, and the task's own Phase 6/Security section explicitly says "do not introduce unnecessary analytics tracking" and "prefer deriving intelligence from existing user-owned data." Building a query-logging table purely to backfill a "you searched for X three times" signal would be exactly that.
- **A new "Working Profile" or personalization-preference model.** It already exists (memory system, §1) and is already correctly retrieval-integrated as of item 1.
- **A general LLM-based feedback-learning loop.** Nothing in this codebase consumes a feedback signal today, and building both the capture UI and a consumption path in the same "v1" pass is a larger, separate scope decision than this phase's ground-truthed items warrant.

## 7. Proposed AI Experience Intelligence architecture

No new module, no new orchestrator, no new type system. The architecture is: **extend the existing `intelligence` module's data (Hub's `IntelligenceItem`/`Recommendation` shapes, both already stable and already rendered) with one small, generic, reusable capability — dismissal — and one new signal computed from data already in hand.**

```
src/modules/intelligence/
  dismissals/
    api.ts                    — listDismissedItemKeys, dismissItem (Supabase, dismissed_suggestions)
    useDismissedSuggestions.ts — optimistic React Query hook, workspace-scoped
  dashboard/
    recommendationItemKey.ts  — category:command.id, the stable identity a Recommendation lacks on its own
```

`item_key` is caller-derived and opaque to the dismissals table — it doesn't know or care whether it's dismissing a Hub `IntelligenceItem` (which already has a stable `.id`) or a `Recommendation` (keyed via `recommendationItemKey`). This mirrors the existing `Recommendation`/`IntelligenceItem` design principle of "one shape, many producers," extended to "one dismissal mechanism, many producers."

The one new signal (unresolved-conversation continuation) is not a new engine — it's one new optional input (`unresolvedConversation`) on `generateRecommendations`'s existing `dashboard` branch, computed by one new query function (`listLastMessageRoles`) called once from `hubData.ts`, using conversations the Hub already fetched.

## 8. Privacy/security considerations

- No pillar in this phase requires exposing reasoning, memory retrieval mechanics, hidden context, or provider decisions. Every item is either data the user already explicitly controls (which of their own suggestions they've dismissed) or presentation of already-computed, already-safe workspace signals.
- `dismissed_suggestions` carries only `user_id`, `workspace_id`, an opaque `item_key` string, and a timestamp — no suggestion content, no AI reasoning, no inferred-preference payload. RLS is own-row-only (`auth.uid() = user_id`), identical to `workspace_objectives`' existing policy.
- The unresolved-conversation signal reads only conversation/message metadata the user already owns (RLS-scoped exactly like every other conversation read in the app) — no new field, no cross-user visibility.
- No new telemetry, no new tracking of search/command usage (see §6). No change to `resolveProviderChain`, provider selection, or anything the Founder Command Center governs.

## 9. Recommended v1 scope

**In scope — safe extensions of existing systems, all implemented this phase:**
1. Confidence-weighted memory retrieval — `rankMemories.ts`, wired into `formatMemoriesForPrompt`/`isMemoryUsedByPrompt`.
2. Reader conversation title parity — `useGenerateConversationTitle` wired into `ReaderChatPanel.handleSend`.
3. Persistent suggestion dismissal — `dismissed_suggestions` table (`0037_dismissed_suggestions.sql`) + `useDismissedSuggestions` hook.
4. Dismissal wired into the Hub's `IntelligenceZoneItems` (all 4 zones) and `RecommendedActionsSection`.
5. Unresolved-conversation continuation nudge — `listLastMessageRoles` + a new optional input on `generateRecommendations`'s dashboard branch.

**Explicitly deferred, with reasoning** (see §6): general LLM-based intent classification, semantic conversation linking, automation/scheduled proactive execution, new search/command telemetry, and acting on feedback signals (no feedback-capture UI exists yet to act on).
