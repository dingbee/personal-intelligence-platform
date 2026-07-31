import { useState } from 'react'
import { useAuth } from '@/modules/auth/useAuth'
import { searchKnowledgeConcepts } from '@/modules/knowledge-intelligence/api/searchKnowledgeConcepts'
import { getKnowledgeNodeEvidence, type KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

/**
 * UX-13.11 Phase 2B — the Graph Layer branch of search, run alongside
 * (not merged into) runUniversalSearch's flat document/note/conversation
 * results, per the "Search finds Documents/Notes/Conversations AND
 * separately Graph Layer" architecture rather than one more flat
 * SearchProvider. A failure here never blanks the rest of the search —
 * same "one source failing shouldn't break search" contract
 * runUniversalSearch already has for its own providers.
 */
export function useConceptSearch() {
  const { user } = useAuth()
  const [concepts, setConcepts] = useState<KnowledgeNodeEvidence[]>([])
  const [loading, setLoading] = useState(false)

  async function search(queryText: string) {
    if (!queryText.trim() || !user) {
      setConcepts([])
      return
    }

    setLoading(true)
    try {
      const nodes = await searchKnowledgeConcepts(queryText, user.id)
      const withEvidence = await Promise.all(nodes.map((node) => getKnowledgeNodeEvidence(node.id)))
      setConcepts(withEvidence)
    } catch (err) {
      console.error('Concept search failed:', err)
      setConcepts([])
    } finally {
      setLoading(false)
    }
  }

  return { search, concepts, loading }
}
