import { describe, expect, it } from 'vitest'
import { buildReasoningTrace } from '@/modules/intelligence/planner/reasoningTrace'
import type { ReasoningPlan } from '@/modules/intelligence/planner/plannerTypes'
import { selectContext } from '@/modules/intelligence/planner/contextSelector'

function plan(overrides: Partial<ReasoningPlan> = {}): ReasoningPlan {
  return {
    intent: 'learn',
    strategy: 'multi-step',
    requiredContext: ['reading_progress', 'notes'],
    responseStrategy: 'tutorial',
    suggestedCommandIds: [],
    ...overrides,
  }
}

describe('buildReasoningTrace', () => {
  it('preserves every existing ContextTrace field unchanged', () => {
    const contextTrace = { retrievedChunks: 4, graphNodes: 2, memoriesUsed: 1 }
    const trace = buildReasoningTrace({
      contextTrace,
      plan: plan(),
      selectedContext: selectContext(plan().requiredContext),
      decisionFramework: null,
      learningMode: null,
    })
    expect(trace.retrievedChunks).toBe(4)
    expect(trace.graphNodes).toBe(2)
    expect(trace.memoriesUsed).toBe(1)
  })

  it('projects intent and responseStrategy from the plan onto top-level fields', () => {
    const trace = buildReasoningTrace({
      contextTrace: { retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 },
      plan: plan({ intent: 'compare', responseStrategy: 'comparison' }),
      selectedContext: selectContext([]),
      decisionFramework: null,
      learningMode: null,
    })
    expect(trace.intent).toBe('compare')
    expect(trace.responseStrategy).toBe('comparison')
  })

  it('includes the full planner output for deeper inspection', () => {
    const thePlan = plan()
    const trace = buildReasoningTrace({
      contextTrace: { retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 },
      plan: thePlan,
      selectedContext: selectContext(thePlan.requiredContext),
      decisionFramework: null,
      learningMode: null,
    })
    expect(trace.planner).toEqual(thePlan)
  })

  it('carries a null decision framework and learning mode through unchanged', () => {
    const trace = buildReasoningTrace({
      contextTrace: { retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 },
      plan: plan(),
      selectedContext: selectContext([]),
      decisionFramework: null,
      learningMode: null,
    })
    expect(trace.decisionFramework).toBeNull()
    expect(trace.learningMode).toBeNull()
  })

  it('carries a real decision framework through unchanged', () => {
    const framework = { options: [{ label: 'A' }, { label: 'B' }], pros: [], cons: [], risks: [], recommendation: null, confidence: 'low' as const }
    const trace = buildReasoningTrace({
      contextTrace: { retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 },
      plan: plan({ intent: 'decide', responseStrategy: 'decision' }),
      selectedContext: selectContext([]),
      decisionFramework: framework,
      learningMode: null,
    })
    expect(trace.decisionFramework).toEqual(framework)
  })

  it('includes the selected context breakdown', () => {
    const trace = buildReasoningTrace({
      contextTrace: { retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 },
      plan: plan({ requiredContext: ['documents'] }),
      selectedContext: selectContext(['documents']),
      decisionFramework: null,
      learningMode: null,
    })
    expect(trace.selectedContext.included).toEqual(['documents'])
  })
})
