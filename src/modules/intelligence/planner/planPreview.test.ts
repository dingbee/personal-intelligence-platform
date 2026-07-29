import { describe, expect, it } from 'vitest'
import { buildPlanPreview } from '@/modules/intelligence/planner/planPreview'
import type { ReasoningPlan } from '@/modules/intelligence/planner/plannerTypes'

function makePlan(overrides: Partial<ReasoningPlan> = {}): ReasoningPlan {
  return {
    intent: 'learn',
    strategy: 'multi-step',
    requiredContext: ['reading_progress', 'notes', 'flashcards', 'recent_conversations'],
    responseStrategy: 'tutorial',
    suggestedCommandIds: [],
    ...overrides,
  }
}

describe('buildPlanPreview', () => {
  it("matches the brief's worked example shape: one numbered step per required context source, plus a final response step", () => {
    const preview = buildPlanPreview(
      makePlan({ requiredContext: ['documents', 'recent_conversations', 'knowledge_graph'], responseStrategy: 'planning' }),
    )
    expect(preview).toHaveLength(4)
    expect(preview.map((s) => s.order)).toEqual([1, 2, 3, 4])
    expect(preview[preview.length - 1]!.description).toBe('Generate recommendations')
  })

  it('numbers steps sequentially starting at 1', () => {
    const preview = buildPlanPreview(makePlan({ requiredContext: ['documents'] }))
    expect(preview.map((s) => s.order)).toEqual([1, 2])
  })

  it('produces at least one step even with no required context (the final response step)', () => {
    const preview = buildPlanPreview(makePlan({ requiredContext: [] }))
    expect(preview).toHaveLength(1)
  })

  it('every step has a non-empty description', () => {
    const preview = buildPlanPreview(makePlan())
    expect(preview.every((step) => step.description.length > 0)).toBe(true)
  })

  it('is a pure function of its input', () => {
    const plan = makePlan()
    expect(buildPlanPreview(plan)).toEqual(buildPlanPreview(plan))
  })
})
