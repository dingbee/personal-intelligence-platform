import { supabase } from '@/shared/lib/supabase'
import { extractLexicalSearchTerms } from '@/modules/ai/orchestration/extractLexicalSearchTerms'
import { normalizeTitle } from '@/modules/knowledge-intelligence/utils/normalizeTitle'
import { getKnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

const MAX_MATCHED_NODES = 3
const MAX_RELATED_PER_NODE = 6
const MAX_EVIDENCE_PER_NODE = 6

/**
 * PIP Sprint 5/10 — the graph-layer counterpart of Sprint 4's lexical
 * chunk fix. `retrieveGraphContext` only ever surfaces knowledge nodes
 * sourced from documents/assets a *chunk* search already matched — if the
 * user asks "What is ARRIYIA connected to?" and no document chunk happens
 * to be in that turn's top matches (or knowledge extraction was never run
 * on the right document), the graph's own ARRIYIA node — evidence,
 * relationships, confidence and all — was structurally unreachable from
 * chat, even though `getKnowledgeNodeEvidence` (used by the Knowledge
 * Explorer UI) already computes exactly that data.
 *
 * This looks the named entity up directly: extract candidate entity terms
 * from the question (reusing extractLexicalSearchTerms, not a new parser),
 * normalize them the same way resolveCanonicalNode does for exact-title
 * matching (no fuzzy merging — a miss here just means no extra context,
 * never a wrong merge), and if a node exists, pull its real evidence via
 * getKnowledgeNodeEvidence — the same rich, already-tested data source the
 * graph UI uses, not a parallel computation.
 */
export async function retrieveNamedEntityGraphContext(params: { text: string; userId: string }): Promise<string | null> {
  try {
    const terms = extractLexicalSearchTerms(params.text)
    if (terms.length === 0) return null

    const normalizedTerms = [...new Set(terms.map((term) => normalizeTitle(term)).filter((t) => t.length > 0))]
    if (normalizedTerms.length === 0) return null

    const { data: nodes, error } = await supabase
      .from('knowledge_nodes')
      .select('id, title, node_type')
      .eq('user_id', params.userId)
      .in('title_normalized', normalizedTerms)
      .limit(MAX_MATCHED_NODES)
    if (error) throw error
    if (!nodes || nodes.length === 0) return null

    const evidenceByNode = await Promise.all(nodes.map((node) => getKnowledgeNodeEvidence(node.id)))
    return formatNamedEntityGraphContext(evidenceByNode)
  } catch {
    return null
  }
}

function confidenceCaveat(confidence: number): string {
  if (confidence >= 0.6) return ''
  if (confidence >= 0.3) return ' (limited evidence — treat as provisional)'
  return ' (very limited evidence — treat with caution)'
}

/** Pure formatting — separated so the text shape is unit-testable without a database. */
export function formatNamedEntityGraphContext(evidenceList: Awaited<ReturnType<typeof getKnowledgeNodeEvidence>>[]): string | null {
  if (evidenceList.length === 0) return null

  const lines: string[] = []
  for (const { node, evidence, relatedNodes, confidence, countsBySourceType } of evidenceList) {
    lines.push(`${node.node_type === 'concept' ? 'Concept' : 'Entity'}: ${node.title}${confidenceCaveat(confidence)}`)

    const sourceSummary = Object.entries(countsBySourceType)
      .map(([type, count]) => `${count} ${type}${count === 1 ? '' : 's'}`)
      .join(', ')
    if (sourceSummary) lines.push(`Evidence: ${sourceSummary}`)

    for (const item of evidence.slice(0, MAX_EVIDENCE_PER_NODE)) lines.push(`- Mentioned in ${item.label} (${item.type})`)

    if (relatedNodes.length > 0) {
      lines.push('Connections:')
      for (const related of relatedNodes.slice(0, MAX_RELATED_PER_NODE)) {
        const { evidenceCount, sources } = related.relationshipConfidence
        const evidenceNote = evidenceCount > 0 ? ` — corroborated by ${evidenceCount} shared source${evidenceCount === 1 ? '' : 's'} (${sources.join(', ')})` : ' — inferred, not directly corroborated'
        lines.push(`- ${related.relationshipType} ${related.title}${evidenceNote}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}
