import { classifyIntelligenceQuery } from '@/modules/knowledge-intelligence/queries/intelligenceQueryClassifier'
import type { IntelligenceQueryType } from '@/modules/knowledge-intelligence/queries/intelligenceQueryTypes'
import { getKnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import { groupEvidenceByPeriod } from '@/modules/knowledge-intelligence/timeline/knowledgeTimeline'
import { detectTopicalKnowledgeGaps } from '@/modules/knowledge-intelligence/api/detectTopicalKnowledgeGaps'
import { buildGraphInteractionState } from '@/modules/knowledge/intelligence/graphInteraction'
import { getExtractionMetadata } from '@/modules/processing/api/extractionMetadata'
import { getAsset } from '@/modules/assets/api/assets'

export interface IntelligenceQueryResult {
  type: IntelligenceQueryType
  /** One-line direct answer, always honest about an empty result rather than inventing content. */
  summary: string
  /** Supporting lines, if any — rendered as a list under the summary. */
  detail: string[]
}

/**
 * Knowledge Intelligence Layer v1, Feature 5 — routes a free-text question
 * to whichever existing composer already answers it. Deliberately scoped
 * to "ask about the concept you're currently viewing": the classifier
 * only resolves *what kind* of question this is, never *which concept* —
 * the node is already known from the page it's asked on, sidestepping the
 * harder free-text entity-resolution problem this codebase has no
 * existing capability for (confirmed in the discovery audit).
 */
export async function runIntelligenceQuery(params: {
  text: string
  nodeId: string
  workspaceId: string | null
  userId: string
  chain: string[]
}): Promise<IntelligenceQueryResult> {
  const { type } = classifyIntelligenceQuery(params.text)

  switch (type) {
    case 'evolution':
      return answerEvolutionQuery(params.nodeId)
    case 'related_sources':
      return answerRelatedSourcesQuery(params.nodeId)
    case 'decisions':
      return answerDecisionsQuery(params.nodeId)
    case 'gaps':
      return answerGapsQuery(params)
    case 'patterns':
      return answerPatternsQuery(params.workspaceId)
  }
}

async function answerEvolutionQuery(nodeId: string): Promise<IntelligenceQueryResult> {
  const evidence = await getKnowledgeNodeEvidence(nodeId)
  const periods = groupEvidenceByPeriod(evidence.evidence)
  if (periods.length === 0) {
    return { type: 'evolution', summary: "There's no dated evidence for this concept yet, so its progression can't be traced.", detail: [] }
  }
  return {
    type: 'evolution',
    summary: `This concept has developed across ${periods.length} period${periods.length === 1 ? '' : 's'}.`,
    detail: periods.map((period) => `${period.label}: ${period.items.length} mention${period.items.length === 1 ? '' : 's'} (${period.items.map((i) => i.label).join(', ')})`),
  }
}

async function answerRelatedSourcesQuery(nodeId: string): Promise<IntelligenceQueryResult> {
  const evidence = await getKnowledgeNodeEvidence(nodeId)
  if (evidence.evidence.length === 0) {
    return { type: 'related_sources', summary: "No documents, notes, images, or conversations reference this concept yet.", detail: [] }
  }
  return {
    type: 'related_sources',
    summary: `${evidence.evidence.length} source${evidence.evidence.length === 1 ? '' : 's'} reference this concept.`,
    detail: evidence.evidence.map((item) => `${item.label} (${item.type})`),
  }
}

async function answerDecisionsQuery(nodeId: string): Promise<IntelligenceQueryResult> {
  const evidence = await getKnowledgeNodeEvidence(nodeId)
  const decisions: string[] = []

  await Promise.all(
    evidence.evidence.map(async (item) => {
      if (item.type === 'document') {
        const metadata = await getExtractionMetadata(item.id).catch(() => null)
        for (const decision of metadata?.metadata.documentIntelligence?.decisions ?? []) decisions.push(`${decision} (${item.label})`)
      } else if (item.type === 'asset') {
        const asset = await getAsset(item.id).catch(() => null)
        for (const decision of asset?.metadata?.documentIntelligence?.decisions ?? []) decisions.push(`${decision} (${item.label})`)
      }
    }),
  )

  if (decisions.length === 0) {
    return { type: 'decisions', summary: 'No explicitly recorded decisions were found in this concept\'s sources.', detail: [] }
  }
  return { type: 'decisions', summary: `${decisions.length} decision${decisions.length === 1 ? '' : 's'} found in this concept's sources.`, detail: decisions }
}

async function answerGapsQuery(params: { userId: string; workspaceId: string | null; chain: string[] }): Promise<IntelligenceQueryResult> {
  const gaps = await detectTopicalKnowledgeGaps(params)
  if (gaps.length === 0) {
    return { type: 'gaps', summary: 'Nothing stood out as conspicuously missing from your workspace.', detail: [] }
  }
  return {
    type: 'gaps',
    summary: `${gaps.length} possible gap${gaps.length === 1 ? '' : 's'} in your workspace, as a suggestion to confirm — not a certainty.`,
    detail: gaps.map((gap) => `${gap.label}${gap.reason ? ` — ${gap.reason}` : ''}`),
  }
}

async function answerPatternsQuery(workspaceId: string | null): Promise<IntelligenceQueryResult> {
  const state = await buildGraphInteractionState({ workspaceId })
  if (state.insights.length === 0) {
    return { type: 'patterns', summary: 'No patterns stand out in your knowledge graph yet.', detail: [] }
  }
  return {
    type: 'patterns',
    summary: `${state.insights.length} pattern${state.insights.length === 1 ? '' : 's'} found in your knowledge graph.`,
    detail: state.insights.map((insight) => `${insight.label}: ${insight.value}`),
  }
}
