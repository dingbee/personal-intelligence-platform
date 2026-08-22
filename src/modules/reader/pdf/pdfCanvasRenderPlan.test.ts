import { describe, expect, it } from 'vitest'
import { computeCanvasRenderPlan } from '@/modules/reader/pdf/pdfCanvasRenderPlan'

describe('computeCanvasRenderPlan', () => {
  it('at DPR 1, backing canvas resolution equals the CSS/logical viewport size', () => {
    const plan = computeCanvasRenderPlan(800, 1000, 1)
    expect(plan).toEqual({ cssWidth: 800, cssHeight: 1000, canvasWidth: 800, canvasHeight: 1000, dpr: 1 })
  })

  it('at DPR 2, the backing canvas is rendered at double the resolution while the CSS size is unchanged', () => {
    const plan = computeCanvasRenderPlan(800, 1000, 2)
    expect(plan.cssWidth).toBe(800)
    expect(plan.cssHeight).toBe(1000)
    expect(plan.canvasWidth).toBe(1600)
    expect(plan.canvasHeight).toBe(2000)
    expect(plan.dpr).toBe(2)
  })

  it('at DPR 3 (a common phone density), the plan caps to 2x rather than rendering an unbounded canvas', () => {
    const plan = computeCanvasRenderPlan(800, 1000, 3)
    expect(plan.dpr).toBe(2)
    expect(plan.canvasWidth).toBe(1600)
    expect(plan.canvasHeight).toBe(2000)
  })

  it('never renders below 1x even if devicePixelRatio reports a fractional or zero value', () => {
    expect(computeCanvasRenderPlan(800, 1000, 0).dpr).toBe(1)
    expect(computeCanvasRenderPlan(800, 1000, 0.5).dpr).toBe(1)
  })

  it('the visual (CSS) page size never changes with DPR — only the backing bitmap resolution does', () => {
    const dpr1 = computeCanvasRenderPlan(612, 792, 1)
    const dpr2 = computeCanvasRenderPlan(612, 792, 2)
    expect(dpr1.cssWidth).toBe(dpr2.cssWidth)
    expect(dpr1.cssHeight).toBe(dpr2.cssHeight)
    expect(dpr2.canvasWidth).toBeGreaterThan(dpr1.canvasWidth)
    expect(dpr2.canvasHeight).toBeGreaterThan(dpr1.canvasHeight)
  })

  it('rounds fractional viewport dimensions (e.g. from a non-integer Fit Width scale) to whole backing pixels', () => {
    const plan = computeCanvasRenderPlan(333.333, 431.7, 2)
    expect(Number.isInteger(plan.canvasWidth)).toBe(true)
    expect(Number.isInteger(plan.canvasHeight)).toBe(true)
    expect(plan.canvasWidth).toBe(Math.round(333.333 * 2))
    expect(plan.canvasHeight).toBe(Math.round(431.7 * 2))
  })
})
