import type { ChatProvider } from '@/modules/ai/providers/ChatProvider'
import { anthropicChatProvider } from '@/modules/ai/providers/anthropic'
import { openaiChatProvider } from '@/modules/ai/providers/openai'
import { geminiChatProvider } from '@/modules/ai/providers/gemini'

/**
 * Runtime chat provider instances, keyed by id. Distinct from
 * modules/core/providers/registry.ts, which only tracks plugin *metadata*
 * (label, status) for UI like the provider picker — this is what actually
 * executes a chat request. AIService is the only thing that should read
 * from this map; UI code asks AIService, not this registry, for a provider.
 */
const chatProviders: Record<string, ChatProvider> = {
  anthropic: anthropicChatProvider,
  openai: openaiChatProvider,
  google: geminiChatProvider,
}

export const DEFAULT_CHAT_PROVIDER_ID = 'anthropic'

export function getChatProvider(id: string = DEFAULT_CHAT_PROVIDER_ID): ChatProvider {
  const provider = chatProviders[id]
  if (!provider) throw new Error(`Unknown chat provider: ${id}`)
  return provider
}
