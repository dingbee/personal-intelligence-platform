# AI Preference Layer v1 — Discovery Report

Read-only audit performed before any implementation, per this phase's own instruction. Your directive's message was cut off mid-sentence at "Preferred structure: Table:" — this audit resolves that gap directly: **a new table is not required.** The nullable column this task asked me to search for already exists and already means exactly what "Auto (Recommended)" needs it to mean.

## 1. Database — does a user AI preference already exist?

**Yes.** `profiles.default_chat_provider_id text` (nullable), added by `0013_default_chat_provider.sql` (Phase 8B), no RLS changes needed at the time since `profiles`' existing self-service `UPDATE` policy already covers every column. `updateDefaultChatProvider(userId, providerId: string | null)` (`src/modules/settings/api/profile.ts`) already accepts and writes `null` — the write path for "clear my preference" is already fully built and working.

None of `user_ai_preferences`/`ai_preferences`/`provider_preference`/`preferred_provider` exist anywhere in the schema — `default_chat_provider_id` is the only preference-shaped column, and it is sufficient: one nullable field, one owner (the user), `null` = no explicit preference. **No new table, no new migration for storage.**

## 2. Frontend — why is "Auto (Recommended)" missing?

Traced end to end, and the cause is not that the option was never built — it's that the value it would represent (`null`) never survives long enough to reach the UI:

1. **`resolveDefaultChatProviderId()`** (`src/modules/ai/providers/defaultProvider.ts`): if the user has no eligible preference, it does not return `null` — it returns the hardcoded module constant `DEFAULT_CHAT_PROVIDER_ID` (`'openai'`, `src/modules/ai/providers/registry.ts`). This is the real bug: it silently converts "no preference" into "a concrete, fixed preference," before anything downstream ever sees the `null`.
2. **`AdvancedSettingsPage.tsx`** then does `value={profile?.default_chat_provider_id ?? defaultProviderId}` — even if step 1 didn't exist, this line coerces `null` into a concrete id before it reaches `<ProviderSelect>`.
3. **`ProviderSelect.tsx`** itself has no "Auto (Recommended)" `<option>` at all — its `value` prop is typed as required `string`, and its option list is built purely from `providerRegistry`, with no null/empty-value entry.

So the missing UI is a direct, mechanical consequence of the value being pre-resolved to something concrete two layers before the component that would need to render "no selection." Nothing about the entitlement gating, Pro-only visibility, or "never in the normal chat composer" rule is wrong — those all audit clean and are untouched by this fix. `ProviderSelect` is used in exactly one place today (`AdvancedSettingsPage`) — its doc comment claiming it's also used in "the in-conversation header" is stale, left over from before that header was removed in the Beta/Admin/AI Governance phase.

## 3. AI routing architecture — is the required priority order already implemented?

**Yes, structurally, in `resolveProviderChain()`** (`src/modules/ai/router/resolveProviderChain.ts`, extended last phase with `platformSettings`):

```
eligibleIds = chatProviders
  .filter(kind === 'chat' && status === 'available')
  .filter(isProviderAvailable(...))            // ← 2. Provider availability
  .filter(platformSettings[id]?.enabled !== false)  // ← 1. Platform governance
rest = eligibleIds - preferredProviderId
orderedRest = sort by platform priority, then health score   // ← 4. Automatic fallback
return preferredProviderId eligible? [preferred, ...orderedRest] : orderedRest  // ← 3. User preference
```

This is exactly the required order: platform governance and availability gate the eligible set first; an eligible user preference goes first if present; everything else (the actual "automatic" case) is ordered by platform priority then live health score. **This function needed zero changes.** The bug is entirely upstream of it: `resolveDefaultChatProviderId()` was handing it a fake "preference" (the hardcoded constant) instead of the user's real, possibly-absent one, so step 3/4's distinction was never actually reachable for a user with no preference — the resolver always saw *some* preferred id and always tried it first, which is indistinguishable from a real preference from the resolver's point of view.

**Systemic scope**: `useDefaultChatProviderId()` feeds `useProviderChain()` at eight call sites — `useSendMessage` (via `ChatPage`/`ReaderChatPanel`), `useGenerateConversationTitle`, `useGenerateBriefing`, `useKnowledgeIntelligence` (×2), `useNote`, `useFlashcards`, `useChapterSummary`, and `useCommandActions` (conversation creation only, not routing). Every one of them inherits this same masking bug — "Auto" has never actually meant "automatic" anywhere in the app, for any AI feature, not just chat.

## 4. A related, deliberately out-of-scope finding: conversation-level pinning

`conversations.provider_id` is a **non-nullable** column. `createConversation()` (`src/modules/ai/chat/api/conversations.ts`) always stamps a concrete provider onto a new conversation at creation time (falling back to `DEFAULT_CHAT_PROVIDER_ID` if nothing is passed). Once stamped, `ChatPage`'s `conversation?.provider_id ?? defaultProviderId` means that stamped value permanently wins as "preferred" for every future send in that conversation — even for a user whose profile preference is "Auto." This is a genuine, separate architectural question (does "Auto" mean "re-decided fresh every message" or "decided once, at conversation creation, then stable for that conversation's life?") that a nullable `conversations.provider_id` + "no override" semantics would need to answer properly. That's schema work beyond this phase's "v1" scope and touches the already-shipped, tested per-conversation provider-switching feature — **not built this phase**, explicitly called out as the natural next increment. What *is* fixed this phase: the one-time stamp at creation now uses the live, fully-governed `resolveProviderChain` result (via the already-computed `useSendMessage` chain) instead of the dumb hardcoded constant, so even that one stamp respects platform governance/availability/health — it's just not re-evaluated on every later send for that same conversation. Every non-chat AI feature (7 of the 8 call sites above) has no such persistence at all and becomes fully, continuously adaptive under this fix.

## 5. Recommended implementation (no schema changes)

1. `resolveDefaultChatProviderId()` / `useDefaultChatProviderId()`: return type widens to `string | null`; stop substituting `DEFAULT_CHAT_PROVIDER_ID` — return the user's raw eligible preference, or `null`.
2. `resolveProviderChain()` / `useProviderChain()`: widen `preferredProviderId` to `string | null` (no internal logic change needed — `eligibleIds.includes(null)` is already `false`, which already produces exactly the correct "automatic" ordering).
3. `useSendMessage()`: widen `providerId` param to `string | null`; expose the resolved `chain` so callers can read `chain[0]` as "what NOVA would actually pick right now" for conversation-creation stamping.
4. `ProviderSelect`: accept `value: string | null`, render a leading `"Auto (Recommended)"` option (`value=""`), `onChange` maps `""` back to `null`.
5. `AdvancedSettingsPage`: pass the raw `profile?.default_chat_provider_id ?? null` straight through — stop coercing into `defaultProviderId`.
6. `ChatPage`/`ReaderChatPanel`/`useCommandActions`: conversation-creation call sites use the live chain's top pick (falling back to `undefined` → `conversations.ts`'s existing constant only in the all-unavailable edge case) instead of raw `defaultProviderId`.
7. Tests: `resolveDefaultChatProviderId` (returns null when unset, returns preference when eligible, falls through when preference ineligible), `resolveProviderChain`/`useProviderChain` already covered (no behavior change for a non-null preferred id); `ProviderSelect` gets its first test file (no prior precedent existed).
8. Docs + `feature-matrix.md` + this discovery doc; commit only after full verification.
