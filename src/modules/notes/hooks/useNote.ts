import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNote, updateNote } from '@/modules/notes/api/notes'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'

export function useNote(noteId: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const { data: availability } = useProviderAvailability()
  const queryKey = ['note', noteId]

  const query = useQuery({
    queryKey,
    queryFn: () => getNote(noteId),
    enabled: Boolean(user) && Boolean(noteId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['notes'] })
  }

  const save = useMutation({
    mutationFn: (updates: { title?: string; content?: string; documentId?: string | null }) =>
      updateNote(noteId, {
        title: updates.title,
        content: updates.content,
        document_id: updates.documentId,
      }),
    onSuccess: invalidate,
  })

  // Only 'summarize' has an active prompt template today (see the Phase 6A
  // audit) — "Improve writing"/"Expand idea" map to capabilities
  // ('rewrite', none exactly) with no template yet, so they're not wired
  // up rather than adding new prompt content this phase.
  const summarize = useMutation({
    mutationFn: async (content: string) => {
      const { content: summary, model } = await withProviderAvailability(
        DEFAULT_CHAT_PROVIDER_ID,
        () =>
          runCapability({
            capabilityId: 'summarize',
            variables: { content },
            userId: user!.id,
            workspaceId: currentWorkspaceId,
          }),
        { availability, queryClient },
      )
      return updateNote(noteId, {
        content: summary,
        generation_metadata: {
          capability: 'summarize',
          provider: DEFAULT_CHAT_PROVIDER_ID,
          model,
          generated_at: new Date().toISOString(),
        },
      })
    },
    onSuccess: invalidate,
  })

  return { note: query.data, isLoading: query.isLoading, isError: query.isError, save, summarize }
}
