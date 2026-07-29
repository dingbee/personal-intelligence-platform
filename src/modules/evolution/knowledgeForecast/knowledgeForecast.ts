import type { ConceptEvolution } from '@/modules/evolution/conceptEvolution/conceptTrend'
import type { KnowledgeHealthIssue } from '@/modules/evolution/knowledgeHealth/knowledgeHealthScore'
import type { MaturityStage } from '@/modules/evolution/workspaceEvolution/workspaceMaturity'
import type { RelationshipEvolution } from '@/modules/evolution/relationshipEvolution/relationshipTrend'

export type ForecastConfidence = 'low' | 'medium' | 'high'

export interface Forecast {
  message: string
  confidence: ForecastConfidence
}

export interface ComputeKnowledgeForecastsInput {
  maturityStage: MaturityStage
  concepts: ConceptEvolution[]
  relationships: RelationshipEvolution
  healthIssues: KnowledgeHealthIssue[]
}

const CENTRAL_TOPIC_MIN_SOURCES_RECENT = 2
const CENTRAL_TOPIC_MIN_DEGREE = 2
const STALE_DOCUMENT_FORECAST_THRESHOLD = 3

/**
 * UX-13 Knowledge Forecast — every statement here is a direct, thresholded
 * read of already-computed deterministic signals (workspace maturity,
 * per-concept trend, relationship growth direction, health issues); there
 * is no model call and no probabilistic estimation, matching the brief's
 * "No ML. Pure deterministic trends." Each forecast's confidence reflects
 * how strong the underlying signal is (e.g. a workspace already flagged
 * 'declining' is a high-confidence forecast; a single growing concept
 * among many is lower), not a statistical measure.
 */
export function computeKnowledgeForecasts(input: ComputeKnowledgeForecastsInput): Forecast[] {
  const forecasts: Forecast[] = []

  if (input.maturityStage === 'declining') {
    forecasts.push({ message: 'This workspace will likely become inactive soon.', confidence: 'high' })
  } else if (input.maturityStage === 'stagnant') {
    forecasts.push({ message: 'This workspace is slowing down and may become inactive.', confidence: 'medium' })
  }

  const risingConcepts = input.concepts
    .filter((c) => c.sourceCountRecent >= CENTRAL_TOPIC_MIN_SOURCES_RECENT && c.degree >= CENTRAL_TOPIC_MIN_DEGREE)
    .sort((a, b) => b.sourceCountRecent + b.degree - (a.sourceCountRecent + a.degree))
  if (risingConcepts.length > 0) {
    forecasts.push({ message: `"${risingConcepts[0]!.title}" is becoming a central topic.`, confidence: 'medium' })
  }

  if (input.relationships.direction === 'down' && input.relationships.allTime > 0) {
    forecasts.push({ message: 'Relationship growth between concepts is slowing down.', confidence: 'low' })
  } else if (input.relationships.direction === 'up') {
    forecasts.push({ message: 'Your knowledge graph is connecting concepts faster than usual.', confidence: 'medium' })
  }

  const staleDocumentIssue = input.healthIssues.find((i) => i.type === 'stale_documents')
  if (staleDocumentIssue && staleDocumentIssue.count >= STALE_DOCUMENT_FORECAST_THRESHOLD) {
    forecasts.push({
      message: `${staleDocumentIssue.count} documents risk going stale if they continue to go unread.`,
      confidence: 'medium',
    })
  }

  const duplicateIssue = input.healthIssues.find((i) => i.type === 'duplicate_concepts')
  if (duplicateIssue) {
    forecasts.push({ message: 'Some knowledge is duplicated and may be worth merging.', confidence: 'medium' })
  }

  return forecasts
}
