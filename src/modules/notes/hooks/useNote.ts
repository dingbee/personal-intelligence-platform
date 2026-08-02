import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNote, updateNote } from '@/modules/notes/api/notes'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'

export function useNote(noteId: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)
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
    onSuccess: (note) => {
      invalidate()
      void indexNote(note, currentWorkspaceId)
      void linkKnownConceptsToSource({ userId: user!.id, sourceType: 'note', sourceId: note.id, text: `${note.title}\n\n${note.content}` })
    },
  })

  // Only 'summarize' has an active prompt template today (see the Phase 6A
  // audit) — "Improve writing"/"Expand idea" map to capabilities
  // ('rewrite', none exactly) with no template yet, so they're not wired
  // up rather than adding new prompt content this phase.
  const summarize = useMutation({
    mutationFn: async (content: string) => {
      const {
        result: { content: summary, model },
        providerId: usedProviderId,
      } = await withProviderAvailability(
        chain,
        () =>
          runWithFallback(chain, (candidateId) =>
            runCapability({
              capabilityId: 'summarize',
              variables: { content },
              userId: user!.id,
              workspaceId: currentWorkspaceId,
              providerId: candidateId,
              requestedProviderId: chain[0],
            }),
          ),
        { queryClient },
      )
      return updateNote(noteId, {
        content: summary,
        generation_metadata: {
          capability: 'summarize',
          provider: usedProviderId,
          model,
          generated_at: new Date().toISOString(),
        },
      })
    },
    onSuccess: (note) => {
      invalidate()
      void indexNote(note, currentWorkspaceId)
      void linkKnownConceptsToSource({ userId: user!.id, sourceType: 'note', sourceId: note.id, text: `${note.title}\n\n${note.content}` })
    },
  })

  return { note: query.data, isLoading: query.isLoading, isError: query.isError, save, summarize }
}
