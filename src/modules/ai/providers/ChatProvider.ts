import type { ChatUsage } from '@/modules/ai/providers/edgeFunctionClient'

/**
 * Multimodal Intelligence v1 — additive: every existing call site that
 * builds `content` as a plain string keeps working unchanged. An image
 * part carries a URL (the asset's signed URL), not inline base64 data —
 * every provider's real API accepts a hosted image URL directly, so this
 * avoids fetching/encoding the image client-side just to pass it through
 * to the edge function.
 */
export type ChatContentPart = { type: 'text'; text: string } | { type: 'image'; imageUrl: string }

export interface ChatProviderMessage {
  role: 'user' | 'assistant'
  content: string | ChatContentPart[]
}

export interface ChatRequest {
  messages: ChatProviderMessage[]
  system?: string
  onUsage?: (usage: ChatUsage) => void
  /**
   * P0-1 (Production Technical Blocker Audit) — which quota_key the
   * `ai-chat` edge function should atomically reserve/consume before ever
   * calling a real provider. Omitted means 'ai_messages' (the universal
   * baseline every plan has); any `*_operations` key is independently
   * re-verified server-side against the caller's actual entitlement — see
   * that function's own `resolveQuotaKey`. Never itself an authorization
   * decision, only a declaration of which pool this call should draw from.
   */
  quotaKey?: string
  /** Everything below is audit-log context only, forwarded to the edge function's server-side ai_requests insert — never used for any authorization decision there. */
  workspaceId?: string | null
  feature?: string
  requestedProvider?: string
  fallbackReason?: string | null
  operationId?: string | null
  operationType?: string | null
}

export interface ChatProvider {
  id: string
  /** Yields text deltas as they arrive — callers consume with `for await`. */
  chat(request: ChatRequest): AsyncGenerator<string>
}
