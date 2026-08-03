import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { importConversationPackage } from '@/modules/knowledge-exchange/conversations/importConversationPackage'
import type { ConversationPackage } from '@/modules/knowledge-exchange/conversations/conversationPackageTypes'

export function useImportConversationPackage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { pkg: ConversationPackage; workspaceId: string | null }) =>
      importConversationPackage(params.pkg, { userId: user!.id, workspaceId: params.workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
