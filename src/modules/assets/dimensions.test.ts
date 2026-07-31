import { describe, expect, it } from 'vitest'
import { computeTargetDimensions, DERIVATIVE_MAX_EDGE } from '@/modules/assets/dimensions'

describe('computeTargetDimensions', () => {
  it('leaves an image smaller than maxEdge unchanged', () => {
    expect(computeTargetDimensions({ width: 200, height: 100 }, 1920)).toEqual({ width: 200, height: 100 })
  })

  it('leaves an image exactly at maxEdge unchanged', () => {
    expect(computeTargetDimensions({ width: 1920, height: 1080 }, 1920)).toEqual({ width: 1920, height: 1080 })
  })

  it('scales down a landscape image to fit maxEdge on its width', () => {
    expect(computeTargetDimensions({ width: 4000, height: 2000 }, 1920)).toEqual({ width: 1920, height: 960 })
  })

  it('scales down a portrait image to fit maxEdge on its height', () => {
    expect(computeTargetDimensions({ width: 2000, height: 4000 }, 1920)).toEqual({ width: 960, height: 1920 })
  })

  it('scales down to the thumbnail size, preserving aspect ratio', () => {
    expect(computeTargetDimensions({ width: 3000, height: 1500 }, DERIVATIVE_MAX_EDGE.thumbnail)).toEqual({
      width: 320,
      height: 160,
    })
  })

  it('never produces a zero dimension for an extreme aspect ratio', () => {
    const result = computeTargetDimensions({ width: 10000, height: 1 }, 320)
    expect(result.width).toBe(320)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })
})
