import { describe, expect, it } from 'vitest'
import { confidenceLabel, scoreMemoryConfidence } from '@/modules/ai/memory/memoryDetection/scoreMemoryConfidence'

describe('scoreMemoryConfidence', () => {
  it('keeps a clean, explicit statement close to its base confidence', () => {
    expect(scoreMemoryConfidence('I prefer dark mode interfaces.', 0.85)).toBeCloseTo(0.85, 2)
  })

  it('heavily reduces confidence for a question', () => {
    expect(scoreMemoryConfidence('Do you think dark mode is better?', 0.85)).toBeLessThan(0.4)
  })

  it('reduces confidence for a hypothetical statement', () => {
    const score = scoreMemoryConfidence('What if I preferred dark mode?', 0.85)
    expect(score).toBeLessThan(scoreMemoryConfidence('I prefer dark mode.', 0.85))
  })

  it('reduces confidence for hedged language', () => {
    const score = scoreMemoryConfidence('I guess I might prefer dark mode.', 0.85)
    expect(score).toBeLessThan(0.85)
  })

  it('reduces confidence for a temporary/task-shaped statement', () => {
    const score = scoreMemoryConfidence('Remind me to use dark mode for now.', 0.85)
    expect(score).toBeLessThan(0.85)
  })

  it('gives a small boost for a strong/explicit marker', () => {
    const score = scoreMemoryConfidence('I always prefer dark mode.', 0.85)
    expect(score).toBeGreaterThan(0.85)
  })

  it('clamps to [0, 1]', () => {
    expect(scoreMemoryConfidence('Maybe, what if, for now?', 0.5)).toBeGreaterThanOrEqual(0)
    expect(scoreMemoryConfidence('I always definitely never forget.', 1)).toBeLessThanOrEqual(1)
  })
})

describe('confidenceLabel', () => {
  it('labels >= 0.8 as High', () => {
    expect(confidenceLabel(0.8)).toBe('High')
    expect(confidenceLabel(0.95)).toBe('High')
  })

  it('labels 0.5-0.79 as Medium', () => {
    expect(confidenceLabel(0.5)).toBe('Medium')
    expect(confidenceLabel(0.79)).toBe('Medium')
  })

  it('labels below 0.5 as Low', () => {
    expect(confidenceLabel(0.49)).toBe('Low')
    expect(confidenceLabel(0)).toBe('Low')
  })
})
