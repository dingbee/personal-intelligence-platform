import type { ChatProvider, ChatRequest } from '@/modules/ai/providers/ChatProvider'
import { streamAiChat } from '@/modules/ai/providers/edgeFunctionClient'

export const geminiChatProvider: ChatProvider = {
  id: 'google',
  chat({ onUsage, ...request }: ChatRequest) {
    return streamAiChat({ action: 'chat', provider: 'google', ...request }, onUsage)
  },
}
