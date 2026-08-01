import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Note } from '@/shared/types/database'
import { mergeNotesIntoOne } from '@/modules/notes/api/mergeNotes'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'

/** Knowledge Actions v1 — Merge Notes. Same onSuccess contract as useNotes' create: index the merged note for search and link it to any concepts it mentions, on top of the merge-specific work already done in mergeNotesIntoOne. */
export function useMergeNotes() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notes: Note[]) => mergeNotesIntoOne({ userId: user!.id, workspaceId: currentWorkspaceId, notes }),
    onSuccess: (merged) => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
      void indexNote(merged, currentWorkspaceId)
      void linkKnownConceptsToSource({
        userId: merged.user_id,
        sourceType: 'note',
        sourceId: merged.id,
        text: `${merged.title}\n\n${merged.content}`,
      })
    },
  })
}
