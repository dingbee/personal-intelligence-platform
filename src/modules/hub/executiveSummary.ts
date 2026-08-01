import type { WorkspaceMaturity } from '@/modules/evolution/workspaceEvolution/workspaceMaturity'
import type { KnowledgeHealthReport } from '@/modules/evolution/knowledgeHealth/knowledgeHealthScore'
import type { KnowledgeGap } from '@/modules/evolution/knowledgeGaps/knowledgeGaps'
import type { Recommendation } from '@/modules/intelligence/recommendations/recommendationEngine'

export interface BuildExecutiveSummaryInput {
  workspaceName: string
  maturity: WorkspaceMaturity
  health: KnowledgeHealthReport
  gaps: KnowledgeGap[]
  recommendations: Recommendation[]
}

/**
 * UX-13.7 — a short prose summary composed entirely from figures the Hub's
 * other sections already compute (maturity, health, gaps, recommendations);
 * this narrates them into 2-3 sentences rather than deriving anything new.
 * Kept pure so it's unit-testable without mocking any of the underlying
 * evolution/dashboard modules.
 */
export function buildExecutiveSummary(input: BuildExecutiveSummaryInput): string {
  const sentences: string[] = []

  sentences.push(`${input.workspaceName} is ${input.maturity.label.toLowerCase()} — ${input.maturity.reason}`)

  const gapClause = input.gaps.length > 0 ? `, with ${input.gaps.length} area${input.gaps.length === 1 ? '' : 's'} worth attention` : ''
  sentences.push(`Knowledge health is ${input.health.score}/100${gapClause}.`)

  if (input.recommendations.length > 0) {
    sentences.push(`Suggested next step: ${input.recommendations[0]!.reason}`)
  }

  return sentences.join(' ')
}
