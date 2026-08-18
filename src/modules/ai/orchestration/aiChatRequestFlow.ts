/**
 * P0-1 hardening pass — a second, deeper pure mirror of
 * `supabase/functions/ai-chat/index.ts`'s `Deno.serve` handler, covering
 * the full chat-action control flow (not just the leaf predicates
 * `aiChatAuthorization.ts` already mirrors): authentication -> plan
 * resolution -> provider entitlement -> model entitlement -> quota-key
 * resolution/feature check -> atomic quota consumption -> provider call ->
 * audit logging, in the exact branch order the edge function executes them
 * in. Every external effect (auth lookup, DB reads, the consume_quota RPC,
 * the actual provider call, the ai_requests insert) is an injected async
 * function (`AiChatFlowDeps`), so a test can substitute fakes and assert on
 * real branching order and call counts — e.g. that a denied request never
 * reaches the provider, or that quota is consumed atomically under
 * concurrency. That's the one thing `aiChatAuthorization.ts`'s
 * pure-predicate mirror cannot prove, since it never exercises call order
 * or side effects.
 *
 * Same dependency-free-mirror convention as aiChatAuthorization.ts (see its
 * header comment for why: no Deno test runner in this repo). Any change to
 * the equivalent logic in `supabase/functions/ai-chat/index.ts`'s
 * `Deno.serve` handler must be mirrored here, and vice versa. Deliberately
 * scoped to the `action: 'chat'` branch only — the P0-1 hardening pass this
 * file was added for is specifically about auth/entitlement/quota
 * enforcement for chat completions; `action: 'embed'` has no equivalent
 * quota-gating logic to mirror (see that branch's own comment in the real
 * function for why embeddings are authenticated/plan-gated but not
 * separately metered).
 */

import { CHAT_PROVIDER_IDS, type ChatProviderId, isModelAllowed, resolveQuotaKey } from '@/modules/ai/orchestration/aiChatAuthorization'

// Mirrors ai-chat/index.ts's own DEFAULT_MODEL exactly.
const DEFAULT_MODEL: Record<ChatProviderId, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5.1',
  google: 'gemini-2.5-flash',
}

export interface AiChatFlowUser {
  id: string
}

export interface AiChatFlowRequest {
  /** `null` mirrors a request with no `Authorization` header at all. */
  authHeader: string | null
  action: 'chat'
  provider: unknown
  model?: string | null
  quotaKey?: string | null
}

export interface AiChatFlowDeps {
  /** Mirrors `callerClient.auth.getUser()` — `null` means missing/invalid/expired JWT. */
  getUser: (authHeader: string) => Promise<AiChatFlowUser | null>
  /** Mirrors the `user_plan_assignments` lookup — `null` means no active plan. */
  getActivePlanId: (userId: string) => Promise<string | null>
  /** Mirrors the `plan_ai_providers` lookup. */
  isProviderAllowedForPlan: (planId: string, provider: ChatProviderId) => Promise<boolean>
  /** Mirrors the `has_feature` RPC. */
  hasFeature: (userId: string, featureKey: string) => Promise<boolean>
  /** Mirrors the `consume_quota` RPC — must be atomic under concurrency, exactly like the real RPC (a single row-locked upsert). */
  consumeQuota: (quotaKey: string) => Promise<boolean>
  /** Mirrors the actual provider fetch (Anthropic/OpenAI/Google). Never called unless every check above passed. */
  callProvider: (args: { userId: string; provider: ChatProviderId; model: string }) => Promise<{ ok: true } | { ok: false; message: string }>
  /** Mirrors `recordAiRequest` — fire-and-forget in the real function, awaited here so tests can observe it deterministically. Only called for an actual provider attempt (success or failure), never for an earlier authorization/quota rejection — matching the real function exactly. */
  recordAudit: (fields: { userId: string; provider: ChatProviderId; quotaKey: string; status: 'success' | 'error'; errorMessage: string | null }) => Promise<void>
}

export interface AiChatFlowResult {
  status: 401 | 400 | 403 | 429 | 502 | 200
  error?: string
}

/** Faithful control-flow mirror of the `action === 'chat'` branch of ai-chat/index.ts's `Deno.serve` handler. */
export async function handleAiChatFlow(req: AiChatFlowRequest, deps: AiChatFlowDeps): Promise<AiChatFlowResult> {
  if (!req.authHeader) return { status: 401, error: 'Authentication required' }

  const user = await deps.getUser(req.authHeader)
  if (!user) return { status: 401, error: 'Authentication required' }

  const planId = await deps.getActivePlanId(user.id)
  if (!planId) return { status: 403, error: 'AI feature not available for this plan' }

  if (!CHAT_PROVIDER_IDS.includes(req.provider as ChatProviderId)) return { status: 400, error: 'Unknown provider' }
  const provider = req.provider as ChatProviderId

  const providerAllowed = await deps.isProviderAllowedForPlan(planId, provider)
  if (!providerAllowed) return { status: 403, error: 'Requested provider is not available for this plan' }

  const expectedModel = DEFAULT_MODEL[provider]
  if (!isModelAllowed(req.model, expectedModel)) return { status: 403, error: 'Requested model is not available for this plan' }

  const resolved = resolveQuotaKey(req.quotaKey)
  if (!resolved.ok) return { status: 400, error: 'Invalid quota key' }

  if (resolved.featureKey) {
    const entitled = await deps.hasFeature(user.id, resolved.featureKey)
    if (!entitled) return { status: 403, error: 'AI feature not available for this plan' }
  }

  const allowed = await deps.consumeQuota(resolved.quotaKey)
  if (!allowed) return { status: 429, error: 'AI quota exceeded' }

  const result = await deps.callProvider({ userId: user.id, provider, model: req.model ?? expectedModel })
  if (!result.ok) {
    await deps.recordAudit({ userId: user.id, provider, quotaKey: resolved.quotaKey, status: 'error', errorMessage: result.message })
    return { status: 502, error: result.message }
  }

  await deps.recordAudit({ userId: user.id, provider, quotaKey: resolved.quotaKey, status: 'success', errorMessage: null })
  return { status: 200 }
}
