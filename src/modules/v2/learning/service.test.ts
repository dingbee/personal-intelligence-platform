import { describe, expect, it } from 'vitest'
import { V2ControlPlaneStore } from '../control-plane/store'
import {
  emitLearningSignal,
  evaluateRecommendationEffectiveness,
  recordFeedback,
  recordIntervention,
} from './service'

const meta = {
  createdAt: '2026-10-03T00:00:00Z',
  updatedAt: '2026-10-03T00:00:00Z',
}

function base() {
  const store = new V2ControlPlaneStore()
  store.save('organization', {
    id: 'org-1',
    organizationId: 'org-1',
    name: 'Org',
    slug: 'org',
    status: 'active',
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  })
  store.save('workspace', {
    id: 'ws-1',
    organizationId: 'org-1',
    name: 'Workspace',
    slug: 'workspace',
    status: 'active',
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  })
  store.save('user', {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'user@example.com',
    displayName: 'User',
    status: 'active',
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  })
  store.save('recommendation', {
    id: 'rec-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    insightIds: [],
    actionType: 'action.execute',
    rationale: 'Test',
    status: 'active',
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  })
  store.save('action', {
    id: 'action-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    type: 'action.execute',
    target: 'target-1',
    parameters: {},
    authorizationPolicyIds: [],
    status: 'active',
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  })
  return store
}

describe('V2-10 learning loop', () => {
  it('records feedback against a scoped recommendation', () => {
    const store = base()

    const feedback = recordFeedback(store, {
      id: 'feedback-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      subjectType: 'recommendation',
      subjectId: 'rec-1',
      submittedBy: 'user-1',
      type: 'positive',
      rating: 0.9,
    }, meta)

    expect(feedback.subjectId).toBe('rec-1')
    expect(store.get('feedback', 'feedback-1')).toEqual(feedback)
  })

  it('rejects interventions that have no traceable subject', () => {
    const store = base()

    expect(() => recordIntervention(store, {
      id: 'intervention-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      intervenedBy: 'user-1',
      type: 'accepted',
      occurredAt: meta.createdAt,
    }, meta)).toThrow()
  })

  it('calculates recommendation effectiveness from interventions, outcomes and feedback', () => {
    const store = base()

    recordIntervention(store, {
      id: 'intervention-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      recommendationId: 'rec-1',
      actionId: 'action-1',
      intervenedBy: 'user-1',
      type: 'accepted',
      occurredAt: meta.createdAt,
    }, meta)

    store.save('outcome', {
      id: 'outcome-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      actionId: 'action-1',
      success: true,
      status: 'active',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    })

    recordFeedback(store, {
      id: 'feedback-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      subjectType: 'recommendation',
      subjectId: 'rec-1',
      submittedBy: 'user-1',
      type: 'positive',
      rating: 1,
    }, meta)

    const effectiveness = evaluateRecommendationEffectiveness(store, 'rec-1', 'ws-1')

    expect(effectiveness.acceptanceRate).toBe(1)
    expect(effectiveness.outcomeSuccessRate).toBe(1)
    expect(effectiveness.feedbackPositiveRate).toBe(1)
    expect(effectiveness.effectivenessScore).toBe(1)
  })

  it('fails closed across workspace boundaries', () => {
    const store = base()
    store.save('workspace', {
      id: 'ws-2',
      organizationId: 'org-1',
      name: 'Other',
      slug: 'other',
      status: 'active',
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    })

    expect(() => evaluateRecommendationEffectiveness(store, 'rec-1', 'ws-2')).toThrow()
  })

  it('stores learning signals with evidence references', () => {
    const store = base()

    const signal = emitLearningSignal(store, {
      id: 'signal-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      signalType: 'recommendation.effectiveness',
      sourceType: 'effectiveness',
      sourceId: 'rec-1',
      subjectType: 'recommendation',
      subjectId: 'rec-1',
      value: 0.82,
      confidence: 0.9,
      evidenceIds: ['feedback-1', 'outcome-1'],
    }, meta)

    expect(signal.value).toBe(0.82)
    expect(signal.evidenceIds).toEqual(['feedback-1', 'outcome-1'])
  })
})
