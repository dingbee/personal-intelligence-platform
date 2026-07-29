import { describe, expect, it } from 'vitest'
import { buildEvolutionTrace } from '@/modules/evolution/evolutionTrace/evolutionTrace'

const NOW = new Date('2026-07-29T00:00:00.000Z')
const INPUTS = { documentCount: 3, noteCount: 2, conceptCount: 5, connectionCount: 4, workspaceAgeDays: 40, recentActivityCount: 2 }

describe('buildEvolutionTrace', () => {
  it('carries through the given inputs, stage, and score unchanged', () => {
    const trace = buildEvolutionTrace({
      workspaceId: 'w1',
      inputs: INPUTS,
      maturityStage: 'growing',
      healthScore: 82,
      forecasts: [],
      now: NOW,
    })
    expect(trace.workspaceId).toBe('w1')
    expect(trace.inputs).toEqual(INPUTS)
    expect(trace.maturityStage).toBe('growing')
    expect(trace.healthScore).toBe(82)
  })

  it('stamps generatedAt with the given now', () => {
    const trace = buildEvolutionTrace({
      workspaceId: null,
      inputs: INPUTS,
      maturityStage: 'active',
      healthScore: 100,
      forecasts: [],
      now: NOW,
    })
    expect(trace.generatedAt).toBe(NOW.toISOString())
  })

  it('takes the first forecast message as topForecast', () => {
    const trace = buildEvolutionTrace({
      workspaceId: 'w1',
      inputs: INPUTS,
      maturityStage: 'declining',
      healthScore: 40,
      forecasts: [
        { message: 'This workspace will likely become inactive soon.', confidence: 'high' },
        { message: 'Something else.', confidence: 'low' },
      ],
      now: NOW,
    })
    expect(trace.topForecast).toBe('This workspace will likely become inactive soon.')
  })

  it('returns a null topForecast when there are no forecasts', () => {
    const trace = buildEvolutionTrace({
      workspaceId: 'w1',
      inputs: INPUTS,
      maturityStage: 'mature',
      healthScore: 90,
      forecasts: [],
      now: NOW,
    })
    expect(trace.topForecast).toBeNull()
  })
})
