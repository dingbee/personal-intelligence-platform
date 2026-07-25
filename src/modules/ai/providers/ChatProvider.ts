import type { ChatUsage } from '@/modules/ai/providers/edgeFunctionClient'

export interface ChatProviderMessage {
  role: 'user' | 'assistant'
  content: string
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
