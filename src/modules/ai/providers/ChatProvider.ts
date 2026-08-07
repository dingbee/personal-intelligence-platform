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
}

export interface ChatProvider {
  id: string
  /** Yields text deltas as they arrive — callers consume with `for await`. */
  chat(request: ChatRequest): AsyncGenerator<string>
}
