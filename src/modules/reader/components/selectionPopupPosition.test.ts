import { describe, expect, it } from 'vitest'
import { computeSelectionPopupPosition } from '@/modules/reader/components/selectionPopupPosition'

/**
 * V1 Launch Hardening, Workstream 4 — deterministic positioning math only.
 * Real collision-avoidance against a given OS's native selection menu
 * (iOS Safari's Copy/Look Up/Share bubble, Android's equivalent) cannot be
 * verified from this environment — no real device/browser is available
 * here — so these tests pin only what's actually verifiable: the popup
 * prefers the space below the selection (where the native menu is not),
 * falls back sensibly when there's no room, and never renders outside the
 * viewport on either axis.
 */

const viewport = { width: 800, height: 600 }

describe('computeSelectionPopupPosition', () => {
  it('anchors below the selection (not above, where native selection menus typically render) when there is room', () => {
    const rect = { top: 100, bottom: 120, left: 200, width: 100 }

    const position = computeSelectionPopupPosition(rect, viewport)

    expect(position.top).toBeGreaterThan(rect.bottom)
  })

  it('centers horizontally over the selection when there is no edge conflict', () => {
    const rect = { top: 100, bottom: 120, left: 200, width: 100 }

    const position = computeSelectionPopupPosition(rect, viewport)

    expect(position.left).toBe(rect.left + rect.width / 2)
  })

  it('falls back to above the selection when there is no room below the viewport', () => {
    const rect = { top: 560, bottom: 580, left: 200, width: 100 }

    const position = computeSelectionPopupPosition(rect, viewport)

    expect(position.top).toBeLessThan(rect.top)
  })

  it('clamps left position so the popup never renders off the left edge of the viewport', () => {
    const rect = { top: 100, bottom: 120, left: 0, width: 10 }

    const position = computeSelectionPopupPosition(rect, viewport)

    expect(position.left).toBeGreaterThanOrEqual(0)
  })

  it('clamps left position so the popup never renders off the right edge of the viewport', () => {
    const rect = { top: 100, bottom: 120, left: 790, width: 10 }

    const position = computeSelectionPopupPosition(rect, viewport)

    expect(position.left).toBeLessThanOrEqual(viewport.width)
  })

  it('never returns a negative top position, even for a selection near the very top of the viewport', () => {
    const rect = { top: 0, bottom: 15, left: 200, width: 100 }

    const position = computeSelectionPopupPosition(rect, viewport)

    expect(position.top).toBeGreaterThanOrEqual(0)
  })

  it('handles a very wide (long, multi-line) selection without producing an out-of-range position', () => {
    const rect = { top: 100, bottom: 200, left: 10, width: 780 }

    const position = computeSelectionPopupPosition(rect, viewport)

    expect(position.left).toBeGreaterThanOrEqual(0)
    expect(position.left).toBeLessThanOrEqual(viewport.width)
  })

  it('produces a deterministic result for the same inputs (pure function, no hidden state)', () => {
    const rect = { top: 100, bottom: 120, left: 200, width: 100 }

    const first = computeSelectionPopupPosition(rect, viewport)
    const second = computeSelectionPopupPosition(rect, viewport)

    expect(first).toEqual(second)
  })
})
