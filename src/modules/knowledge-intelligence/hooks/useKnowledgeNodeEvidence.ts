import { useQuery } from '@tanstack/react-query'
import { getKnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

/** UX-13.11 Phase 2B — backs both the Concept Card (search results) and the node drill-down page. */
export function useKnowledgeNodeEvidence(nodeId: string) {
  return useQuery({
    queryKey: ['knowledge-node-evidence', nodeId],
    queryFn: () => getKnowledgeNodeEvidence(nodeId),
    enabled: Boolean(nodeId),
  })
}
