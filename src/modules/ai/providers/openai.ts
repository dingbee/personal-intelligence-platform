import type { ChatProvider, ChatRequest } from '@/modules/ai/providers/ChatProvider'
import { streamAiChat } from '@/modules/ai/providers/edgeFunctionClient'

export const openaiChatProvider: ChatProvider = {
  id: 'openai',
  chat(request: ChatRequest) {
    return streamAiChat({ action: 'chat', provider: 'openai', ...request })
  },
}
