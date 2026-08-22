import { describe, expect, it, vi, beforeEach } from 'vitest'

const { recordIntelligenceOutcomeMock } = vi.hoisted(() => ({ recordIntelligenceOutcomeMock: vi.fn() }))
vi.mock('@/modules/learning-intelligence/api/recordIntelligenceOutcome', () => ({ recordIntelligenceOutcome: recordIntelligenceOutcomeMock }))

import { writeIntelligenceOutcome } from '@/modules/learning-intelligence/api/writeIntelligenceOutcome'

const params = { recordId: 'record-1', source: 'system_observed' as const, expectedOutcome: 'x', actualOutcome: 'y', comparisonResult: 'match' as const, patternKey: 'test:pattern' }

describe('writeIntelligenceOutcome', () => {
  beforeEach(() => {
    recordIntelligenceOutcomeMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('delegates straight through to recordIntelligenceOutcome on success', async () => {
    recordIntelligenceOutcomeMock.mockResolvedValueOnce({ id: 'evaluation-1' })

    const result = await writeIntelligenceOutcome(params)

    expect(recordIntelligenceOutcomeMock).toHaveBeenCalledWith(params)
    expect(result).toEqual({ id: 'evaluation-1' })
  })

  it('never throws when the recording fails — an automatic learning-layer failure must not break the caller (e.g. execution completion)', async () => {
    recordIntelligenceOutcomeMock.mockRejectedValueOnce(new Error('learning_intelligence not entitled'))

    await expect(writeIntelligenceOutcome(params)).resolves.toBeNull()
  })

  it('logs the failure via console.error rather than swallowing it silently', async () => {
    const error = new Error('boom')
    recordIntelligenceOutcomeMock.mockRejectedValueOnce(error)

    await writeIntelligenceOutcome(params)

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failed to persist'), error)
  })
})
