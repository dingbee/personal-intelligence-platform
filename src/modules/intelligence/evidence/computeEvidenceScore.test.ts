import { describe, expect, it } from 'vitest'
import { computeEvidenceScore } from '@/modules/intelligence/evidence/computeEvidenceScore'

describe('computeEvidenceScore', () => {
  it('is Low when nothing was retrieved, regardless of other signals', () => {
    expect(
      computeEvidenceScore({ contextTrace: { retrievedChunks: 0, graphNodes: 5, memoriesUsed: 5 }, isContinuation: true }),
    ).toBe('Low')
  })

  it('is High with strong retrieval plus corroboration', () => {
    expect(
      computeEvidenceScore({ contextTrace: { retrievedChunks: 4, graphNodes: 2, memoriesUsed: 0 }, isContinuation: false }),
    ).toBe('High')
  })

  it('is Medium with strong retrieval but no corroboration', () => {
    expect(
      computeEvidenceScore({ contextTrace: { retrievedChunks: 5, graphNodes: 0, memoriesUsed: 0 }, isContinuation: false }),
    ).toBe('Medium')
  })

  it('is Medium with light retrieval plus some corroboration', () => {
    expect(
      computeEvidenceScore({ contextTrace: { retrievedChunks: 1, graphNodes: 1, memoriesUsed: 0 }, isContinuation: false }),
    ).toBe('Medium')
  })

  it('is Medium with light retrieval and no corroboration (some evidence beats none)', () => {
    expect(
      computeEvidenceScore({ contextTrace: { retrievedChunks: 1, graphNodes: 0, memoriesUsed: 0 }, isContinuation: false }),
    ).toBe('Medium')
  })
})
