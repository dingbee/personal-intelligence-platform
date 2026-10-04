import type {
  Feedback,
  FeedbackType,
  Intervention,
  InterventionType,
  LearningSignal,
  Recommendation,
  UUID,
} from '../domain/model'
import { V2ControlPlaneStore } from '../control-plane/store'

export type LearningMetadata = Pick<Feedback, 'createdAt' | 'updatedAt'>

export type RecommendationEffectiveness = {
  recommendationId: UUID
  interventionCount: number
  acceptedCount: number
  rejectedCount: number
  modifiedCount: number
  outcomeCount: number
  successfulOutcomeCount: number
  feedbackCount: number
  positiveFeedbackCount: number
  negativeFeedbackCount: number
  acceptanceRate: number
  outcomeSuccessRate: number
  feedbackPositiveRate: number
  effectivenessScore: number
}

export function recordFeedback(
  store: V2ControlPlaneStore,
  input: {
    id: UUID
    organizationId: UUID
    workspaceId: UUID
    subjectType: Feedback['subjectType']
    subjectId: UUID
    submittedBy: UUID
    type: FeedbackType
    rating?: number
    comment?: string
    correction?: Record<string, unknown>
  },
  metadata: LearningMetadata,
): Feedback {
  if (input.rating !== undefined && (!Number.isFinite(input.rating) || input.rating < 0 || input.rating > 1)) {
    throw new Error('V2 feedback rating must be between 0 and 1.')
  }
  const subject = store.getScoped(input.subjectType, input.subjectId, { organizationId: input.organizationId, workspaceId: input.workspaceId })
  if (!subject) throw new Error('V2 feedback subject is not in scope.')

  const feedback: Feedback = {
    id: input.id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    submittedBy: input.submittedBy,
    type: input.type,
    rating: input.rating,
    comment: input.comment,
    correction: input.correction,
    status: 'active',
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }

  store.save('feedback', feedback)
  return feedback
}

export function recordIntervention(
  store: V2ControlPlaneStore,
  input: {
    id: UUID
    organizationId: UUID
    workspaceId: UUID
    recommendationId?: UUID
    actionId?: UUID
    runId?: UUID
    intervenedBy: UUID
    type: InterventionType
    reason?: string
    occurredAt: string
  },
  metadata: LearningMetadata,
): Intervention {
  if (!input.recommendationId && !input.actionId && !input.runId) {
    throw new Error('V2 intervention requires a recommendation, action or run reference.')
  }

  if (input.recommendationId) {
    const recommendation = store.getScoped('recommendation', input.recommendationId, {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    })
    if (!recommendation) throw new Error('V2 intervention recommendation is not in scope.')
  }
  if (input.actionId && !store.getScoped('action', input.actionId, { organizationId: input.organizationId, workspaceId: input.workspaceId })) {
    throw new Error('V2 intervention action is not in scope.')
  }
  if (input.runId && !store.getScoped('run', input.runId, { organizationId: input.organizationId, workspaceId: input.workspaceId })) {
    throw new Error('V2 intervention run is not in scope.')
  }

  const intervention: Intervention = {
    id: input.id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    recommendationId: input.recommendationId,
    actionId: input.actionId,
    runId: input.runId,
    intervenedBy: input.intervenedBy,
    type: input.type,
    reason: input.reason,
    occurredAt: input.occurredAt,
    status: 'active',
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }

  store.save('intervention', intervention)
  return intervention
}

export function evaluateRecommendationEffectiveness(
  store: V2ControlPlaneStore,
  recommendationId: UUID,
  workspaceId: UUID,
): RecommendationEffectiveness {
  const recommendation = store.getScoped('recommendation', recommendationId, {
    organizationId: store.get('recommendation', recommendationId)?.organizationId ?? '',
    workspaceId,
  }) as Recommendation | undefined

  if (!recommendation) throw new Error('V2 recommendation is not in scope.')

  const interventions = store.list('intervention', {
    organizationId: recommendation.organizationId,
    workspaceId,
  }).filter((item) => item.recommendationId === recommendationId)

  const feedback = store.list('feedback', {
    organizationId: recommendation.organizationId,
    workspaceId,
  }).filter((item) => item.subjectType === 'recommendation' && item.subjectId === recommendationId)

  const actionIds = new Set(interventions.map((item) => item.actionId).filter(Boolean) as UUID[])
  const outcomes = store.list('outcome', {
    organizationId: recommendation.organizationId,
    workspaceId,
  }).filter((item) => Boolean(item.actionId && actionIds.has(item.actionId)))

  const acceptedCount = interventions.filter((item) => item.type === 'accepted').length
  const rejectedCount = interventions.filter((item) => item.type === 'rejected').length
  const modifiedCount = interventions.filter((item) => item.type === 'modified' || item.type === 'overridden').length
  const positiveFeedbackCount = feedback.filter((item) => item.type === 'positive' || (item.rating ?? 0) >= 0.5).length
  const negativeFeedbackCount = feedback.filter((item) => item.type === 'negative' || (item.rating !== undefined && item.rating < 0.5)).length
  const successfulOutcomeCount = outcomes.filter((item) => item.success).length

  const interventionCount = interventions.length
  const outcomeCount = outcomes.length
  const feedbackCount = feedback.length

  const acceptanceRate = interventionCount ? acceptedCount / interventionCount : 0
  const outcomeSuccessRate = outcomeCount ? successfulOutcomeCount / outcomeCount : 0
  const feedbackPositiveRate = feedbackCount ? positiveFeedbackCount / feedbackCount : 0

  const effectivenessScore =
    (acceptanceRate * 0.4) +
    (outcomeSuccessRate * 0.4) +
    (feedbackPositiveRate * 0.2)

  return {
    recommendationId,
    interventionCount,
    acceptedCount,
    rejectedCount,
    modifiedCount,
    outcomeCount,
    successfulOutcomeCount,
    feedbackCount,
    positiveFeedbackCount,
    negativeFeedbackCount,
    acceptanceRate,
    outcomeSuccessRate,
    feedbackPositiveRate,
    effectivenessScore,
  }
}

export function emitLearningSignal(
  store: V2ControlPlaneStore,
  input: {
    id: UUID
    organizationId: UUID
    workspaceId: UUID
    signalType: string
    sourceType: LearningSignal['sourceType']
    sourceId: UUID
    subjectType: LearningSignal['subjectType']
    subjectId: UUID
    value: number
    confidence?: number
    evidenceIds: UUID[]
  },
  metadata: LearningMetadata,
): LearningSignal {
  if (!Number.isFinite(input.value)) throw new Error('V2 learning signal value must be finite.')
  if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) {
    throw new Error('V2 learning signal confidence must be between 0 and 1.')
  }

  const signal: LearningSignal = {
    id: input.id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    signalType: input.signalType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    value: input.value,
    confidence: input.confidence,
    evidenceIds: [...input.evidenceIds],
    status: 'active',
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }

  store.save('learningSignal', signal)
  return signal
}
