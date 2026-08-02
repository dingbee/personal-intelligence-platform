import { useQuery } from '@tanstack/react-query'
import { getRelatedKnowledgeForNote } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

/** UX-14.4.4 — thin query wrapper, same convention every other single-purpose notes/knowledge hook already follows. */
export function useRelatedKnowledge(noteId: string) {
  return useQuery({
    queryKey: ['related-knowledge', noteId],
    queryFn: () => getRelatedKnowledgeForNote(noteId),
    enabled: Boolean(noteId),
  })
}
