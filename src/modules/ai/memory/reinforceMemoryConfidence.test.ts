import { describe, expect, it } from 'vitest'
import { REINFORCEMENT_STEP, reinforceConfidence } from '@/modules/ai/memory/reinforceMemoryConfidence'

describe('reinforceConfidence', () => {
  it('increases confidence toward 1 on a single reinforcement', () => {
    const result = reinforceConfidence(0.6)
    expect(result).toBeGreaterThan(0.6)
    expect(result).toBeCloseTo(0.6 + (1 - 0.6) * REINFORCEMENT_STEP, 10)
  })

  it('has diminishing returns — each successive reinforcement adds a smaller increment than the last', () => {
    const first = reinforceConfidence(0.5)
    const second = reinforceConfidence(first)
    const third = reinforceConfidence(second)

    const firstIncrement = first - 0.5
    const secondIncrement = second - first
    const thirdIncrement = third - second

    expect(secondIncrement).toBeLessThan(firstIncrement)
    expect(thirdIncrement).toBeLessThan(secondIncrement)
    expect(secondIncrement).toBeGreaterThan(0)
    expect(thirdIncrement).toBeGreaterThan(0)
  })

  it('never exceeds 1, even after many repeated reinforcements', () => {
    let confidence = 0.1
    for (let i = 0; i < 200; i += 1) {
      confidence = reinforceConfidence(confidence)
      expect(confidence).toBeLessThanOrEqual(1)
    }
    expect(confidence).toBeLessThan(1)
    expect(confidence).toBeGreaterThan(0.99)
  })

  it('never goes below 0 for an already-zero base', () => {
    expect(reinforceConfidence(0)).toBeGreaterThanOrEqual(0)
    expect(reinforceConfidence(0)).toBeCloseTo(REINFORCEMENT_STEP, 10)
  })

  it('is a no-op at exactly 1 (clamped, not pushed past)', () => {
    expect(reinforceConfidence(1)).toBe(1)
  })
})
