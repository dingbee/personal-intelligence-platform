import { describe, expect, it } from 'vitest'
import { applyImportanceBonus, computeImportanceBonus } from '@/modules/search/ranking/importanceScore'

describe('computeImportanceBonus', () => {
  it('returns 0 for a source no concept cites', () => {
    expect(computeImportanceBonus(0)).toBe(0)
  })

  it('increases with more citing concepts', () => {
    expect(computeImportanceBonus(3)).toBeGreaterThan(computeImportanceBonus(1))
  })

  it('caps the bonus so importance never dominates the score', () => {
    expect(computeImportanceBonus(1000)).toBeLessThanOrEqual(0.1)
  })
})

describe('applyImportanceBonus', () => {
  it('is a no-op when evidenceCount is undefined (a source this signal has no data for)', () => {
    expect(applyImportanceBonus(0.5, undefined)).toBe(0.5)
  })

  it('is a no-op when evidenceCount is 0', () => {
    expect(applyImportanceBonus(0.5, 0)).toBe(0.5)
  })

  it('adds the bonus for a cited source', () => {
    expect(applyImportanceBonus(0.5, 2)).toBeGreaterThan(0.5)
  })

  it('never pushes similarity above 1', () => {
    expect(applyImportanceBonus(0.99, 100)).toBeLessThanOrEqual(1)
  })
})
