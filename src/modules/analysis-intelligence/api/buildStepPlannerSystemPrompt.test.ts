import { describe, expect, it } from 'vitest'
import { buildStepPlannerSystemPrompt } from '@/modules/analysis-intelligence/api/buildStepPlannerSystemPrompt'

describe('buildStepPlannerSystemPrompt', () => {
  it('includes the schema, question, step position, and all three response shapes', () => {
    const prompt = buildStepPlannerSystemPrompt({
      schemaDescription: 'Sheet: "Sales"\nColumns:\n- "Region"',
      question: 'Why is South high?',
      stepIndex: 2,
      maxSteps: 5,
      priorObservations: ['South rate: 0.26'],
      investigatedDimensions: ['Region'],
    })
    expect(prompt).toContain('Sheet: "Sales"')
    expect(prompt).toContain('Why is South high?')
    expect(prompt).toContain('step 2 of at most 5')
    expect(prompt).toContain('South rate: 0.26')
    expect(prompt).toContain('Region')
    expect(prompt).toContain('"stop": true')
    expect(prompt).toContain('"error"')
    expect(prompt).toContain('"plan"')
  })

  it('states "none yet" when there are no prior observations or investigated dimensions', () => {
    const prompt = buildStepPlannerSystemPrompt({
      schemaDescription: 'Sheet: "Sales"',
      question: 'Why is South high?',
      stepIndex: 1,
      maxSteps: 5,
      priorObservations: [],
      investigatedDimensions: [],
    })
    expect(prompt).toContain('this is the first step')
    expect(prompt).toContain('(none yet)')
  })
})
