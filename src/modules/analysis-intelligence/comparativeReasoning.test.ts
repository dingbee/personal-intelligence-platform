import { describe, expect, it } from 'vitest'
import { percentagePointDifference, rankByValue, relativePercentageDifference } from '@/modules/analysis-intelligence/comparativeReasoning'

describe('percentagePointDifference', () => {
  it('computes a - b', () => {
    expect(percentagePointDifference(26.1, 21.7)).toBeCloseTo(4.4, 10)
  })
  it('is null when either input is null', () => {
    expect(percentagePointDifference(null, 21.7)).toBeNull()
    expect(percentagePointDifference(26.1, null)).toBeNull()
  })
})

describe('relativePercentageDifference', () => {
  it('computes (a-b)/|b|*100', () => {
    expect(relativePercentageDifference(120, 100)).toBeCloseTo(20, 10)
    expect(relativePercentageDifference(80, 100)).toBeCloseTo(-20, 10)
  })
  it('is null when b is 0, never Infinity/NaN', () => {
    expect(relativePercentageDifference(50, 0)).toBeNull()
  })
  it('is null when either input is null', () => {
    expect(relativePercentageDifference(null, 100)).toBeNull()
    expect(relativePercentageDifference(50, null)).toBeNull()
  })
})

describe('rankByValue', () => {
  it('ranks descending and computes share of total', () => {
    const ranked = rankByValue([
      { entry: 'Alice', value: 3225.5 },
      { entry: 'Bob', value: 2014 },
      { entry: 'Carol', value: 2136 },
    ])
    expect(ranked.map((r) => r.entry)).toEqual(['Alice', 'Carol', 'Bob'])
    expect(ranked[0]!.rank).toBe(1)
    const total = 3225.5 + 2014 + 2136
    expect(ranked[0]!.shareOfTotalPercent).toBeCloseTo((3225.5 / total) * 100, 10)
  })

  it('gives tied values the same dense rank', () => {
    const ranked = rankByValue([
      { entry: 'A', value: 10 },
      { entry: 'B', value: 10 },
      { entry: 'C', value: 5 },
    ])
    expect(ranked[0]!.rank).toBe(1)
    expect(ranked[1]!.rank).toBe(1)
    expect(ranked[2]!.rank).toBe(2)
  })

  it('excludes null values and handles an all-null/zero-total input safely', () => {
    const ranked = rankByValue([{ entry: 'A', value: null }])
    expect(ranked).toEqual([])
  })
})
