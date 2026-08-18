/**
 * P0-1 (Production Technical Blocker Audit) — pure, framework-agnostic
 * mirror of `supabase/functions/ai-chat/index.ts`'s request-validation and
 * quota-key-resolution decision logic. Deliberately dependency-free (no
 * Supabase client, no Deno API) so it can be exercised under `vitest run`,
 * this repo's actual verification gate — the edge function itself runs on
 * Deno, which this repo has no test runner for (the same constraint
 * `send-workspace-invitation`'s own `buildInvitationEmail.ts` documents).
 * `supabase/functions/ai-chat/index.ts` mirrors this same logic inline —
 * any change here must be mirrored there, and vice versa.
 *
 * What this file does NOT cover (because it requires a live database):
 * authentication (JWT verification), the caller's actual resolved plan,
 * `plan_ai_providers`/`has_feature`/`consume_quota` RPC results. Those are
 * exercised by the SQL security-test convention this codebase already
 * uses for its other RPCs (0041/0046's own `resolve_effective_quota_limit`/
 * `has_feature`/`consume_quota` are pre-existing, already-tested functions
 * this feature reuses unmodified — no new SQL was written for P0-1).
 */

export type ChatProviderId = 'anthropic' | 'openai' | 'google'

export const CHAT_PROVIDER_IDS: ChatProviderId[] = ['anthropic', 'openai', 'google']

export function isChatProviderId(value: unknown): value is ChatProviderId {
  return typeof value === 'string' && (CHAT_PROVIDER_IDS as string[]).includes(value)
}

export interface ChatContentPart {
  type: 'text' | 'image'
  text?: string
  imageUrl?: string
}

export interface ChatMessageLike {
  role?: unknown
  content?: unknown
}

/** Mirrors ai-chat/index.ts's isChatMessage exactly. */
export function isChatMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as ChatMessageLike
  if (v.role !== 'user' && v.role !== 'assistant') return false
  if (typeof v.content === 'string') return true
  return Array.isArray(v.content) && v.content.length > 0
}

export interface ChatRequestBodyLike {
  action?: unknown
  provider?: unknown
  messages?: unknown
  input?: unknown
}

/** Mirrors ai-chat/index.ts's isRequestBody exactly. */
export function isValidAiChatRequestBody(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as ChatRequestBodyLike
  if (v.action === 'chat') {
    return typeof v.provider === 'string' && Array.isArray(v.messages) && v.messages.length > 0 && v.messages.every(isChatMessage)
  }
  if (v.action === 'embed') {
    return Array.isArray(v.input) && v.input.length > 0 && v.input.every((item) => typeof item === 'string')
  }
  return false
}

// Mirrors src/shared/lib/intelligenceOperations.ts's
// INTELLIGENCE_OPERATION_QUOTA_KEYS exactly (quota key -> the feature key
// has_feature() expects — the same string with '_operations' stripped).
export const OPERATION_FEATURE_BY_QUOTA_KEY: Record<string, string> = {
  data_intelligence_operations: 'data_intelligence',
  analysis_intelligence_operations: 'analysis_intelligence',
  research_intelligence_operations: 'research_intelligence',
  planning_intelligence_operations: 'planning_intelligence',
  decision_intelligence_operations: 'decision_intelligence',
  action_intelligence_operations: 'action_intelligence',
}

export type ResolvedQuotaKey = { ok: true; quotaKey: string; featureKey: string | null } | { ok: false; reason: 'invalid_quota_key' }

/**
 * Pure decision half of ai-chat/index.ts's resolveQuotaKey — everything
 * except the actual has_feature() database call, which the edge function
 * performs itself once this confirms the key is at least well-formed.
 * Absent/'ai_messages' resolves immediately with no feature check needed
 * (the universal baseline every plan has); any other value must be one of
 * the known `*_operations` keys or is rejected outright — never silently
 * coerced to 'ai_messages', since that would let a typo'd or malicious key
 * look like a successful (if lesser) charge instead of a clear error.
 */
export function resolveQuotaKey(requested: string | undefined | null): ResolvedQuotaKey {
  if (!requested || requested === 'ai_messages') return { ok: true, quotaKey: 'ai_messages', featureKey: null }

  const featureKey = OPERATION_FEATURE_BY_QUOTA_KEY[requested]
  if (!featureKey) return { ok: false, reason: 'invalid_quota_key' }

  return { ok: true, quotaKey: requested, featureKey }
}

/**
 * No per-model entitlement table exists anywhere in this schema
 * (plan_ai_providers is provider-level only) and no legitimate client call
 * site ever actually sends a `model` override today. The only defensible
 * "entitled model" this system can honor without inventing a new business
 * rule is the single canonical model the edge function itself already
 * designates per provider (DEFAULT_MODEL) — so an explicit client-supplied
 * model must match it exactly; omitting `model` is always allowed.
 */
export function isModelAllowed(requestedModel: string | undefined | null, expectedModel: string): boolean {
  return !requestedModel || requestedModel === expectedModel
}
