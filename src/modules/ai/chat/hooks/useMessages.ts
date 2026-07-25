import { useQuery } from '@tanstack/react-query'
import { listMessages } from '@/modules/ai/chat/api/messages'

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => listMessages(conversationId!),
    enabled: Boolean(conversationId),
  })
}
