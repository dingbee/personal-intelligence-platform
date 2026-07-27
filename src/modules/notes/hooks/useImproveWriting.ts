import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { runCapability } from '@/modules/ai/orchestration/runCapability'

/** AI-assisted rewrite of a note's HTML content — same one-shot capability path as Summarize/Flashcards. */
export function useImproveWriting() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()

  return useMutation({
    mutationFn: async (content: string) => {
      const { content: revised } = await runCapability({
        capabilityId: 'rewrite',
        variables: { content },
        userId: user!.id,
        workspaceId: currentWorkspaceId,
      })
      return revised
    },
  })
}
