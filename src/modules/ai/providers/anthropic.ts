import type { ChatProvider, ChatRequest } from '@/modules/ai/providers/ChatProvider'
import { streamAiChat } from '@/modules/ai/providers/edgeFunctionClient'

export const anthropicChatProvider: ChatProvider = {
  id: 'anthropic',
  chat({ onUsage, ...request }: ChatRequest) {
    return streamAiChat({ action: 'chat', provider: 'anthropic', ...request }, onUsage)
  },
}
