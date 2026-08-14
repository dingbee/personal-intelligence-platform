import { describe, expect, it } from 'vitest'
import { buildResearchStepPlannerSystemPrompt } from '@/modules/research-intelligence/api/buildResearchStepPlannerSystemPrompt'

describe('buildResearchStepPlannerSystemPrompt', () => {
  it('includes question, scope, context, step position, and all shapes when no dataset is available', () => {
    const prompt = buildResearchStepPlannerSystemPrompt({
      question: 'Why are regional returns different?',
      scope: 'Last quarter only',
      context: 'Retail operations review',
      stepIndex: 2,
      maxSteps: 4,
      priorSteps: [{ purpose: 'baseline', query: 'return rate policy', evidenceCount: 2, observations: ['Policy X applies'] }],
      datasetAvailable: false,
      datasetUsed: false,
    })

    expect(prompt).toContain('Why are regional returns different?')
    expect(prompt).toContain('Last quarter only')
    expect(prompt).toContain('Retail operations review')
    expect(prompt).toContain('step 2 of at most 4')
    expect(prompt).toContain('"action": "search"')
    expect(prompt).toContain('"stop": true')
    expect(prompt).toContain('"error"')
    expect(prompt).not.toContain('analyze_dataset')
  })

  it('offers the analyze_dataset action only when a dataset is available and not yet used', () => {
    const available = buildResearchStepPlannerSystemPrompt({
      question: 'q', scope: null, context: null, stepIndex: 1, maxSteps: 4, priorSteps: [], datasetAvailable: true, datasetUsed: false,
    })
    expect(available).toContain('"action": "analyze_dataset"')

    const alreadyUsed = buildResearchStepPlannerSystemPrompt({
      question: 'q', scope: null, context: null, stepIndex: 2, maxSteps: 4, priorSteps: [], datasetAvailable: true, datasetUsed: true,
    })
    expect(alreadyUsed).not.toContain('"action": "analyze_dataset"')
  })

  it('states "(none yet" when there are no prior steps, and "(not specified)" for missing scope/context', () => {
    const prompt = buildResearchStepPlannerSystemPrompt({
      question: 'q', scope: null, context: null, stepIndex: 1, maxSteps: 4, priorSteps: [], datasetAvailable: false, datasetUsed: false,
    })
    expect(prompt).toContain('(none yet')
    expect(prompt).toContain('(not specified)')
  })
})
