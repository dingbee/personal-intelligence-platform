/**
 * V1 Launch Hardening, Workstream 4 — pure positioning math for the
 * Highlight/Copy popup that floats over a text selection in the Reader.
 *
 * The prior fixed `rect.top - 44` placement put the popup directly above
 * the selection, which is exactly where iOS Safari's and Android's native
 * Copy/Look Up/Share menu renders — the two would occupy the same screen
 * real estate. This does not suppress or alter the native menu in any
 * way (impossible from page script, and out of scope regardless); it only
 * moves ARRIYIA's own popup out of that space by preferring to anchor
 * below the selection instead of above it, and clamps both axes to the
 * viewport so it can't render off-screen for a selection near an edge.
 *
 * Kept as a pure function (no DOM reads) specifically so the positioning
 * logic itself is unit-testable without a real browser — actual
 * collision-avoidance with a given OS's native selection menu cannot be
 * verified from this environment and is not claimed to be; see the
 * accompanying report for that limitation.
 */

export interface SelectionRect {
  top: number
  bottom: number
  left: number
  width: number
}

export interface Viewport {
  width: number
  height: number
}

export interface PopupPosition {
  top: number
  left: number
}

/** Rough popup footprint used only for edge-clamping math — not a pixel-perfect measurement, since exact rendered size varies with font metrics. */
const POPUP_HEIGHT_ESTIMATE = 36
const POPUP_WIDTH_ESTIMATE = 160
const VIEWPORT_MARGIN = 8
const SELECTION_GAP = 8

export function computeSelectionPopupPosition(rect: SelectionRect, viewport: Viewport): PopupPosition {
  const belowTop = rect.bottom + SELECTION_GAP
  const fitsBelow = belowTop + POPUP_HEIGHT_ESTIMATE <= viewport.height - VIEWPORT_MARGIN
  const top = fitsBelow ? belowTop : Math.max(VIEWPORT_MARGIN, rect.top - SELECTION_GAP - POPUP_HEIGHT_ESTIMATE)

  const halfWidth = POPUP_WIDTH_ESTIMATE / 2
  const idealLeft = rect.left + rect.width / 2
  const minLeft = VIEWPORT_MARGIN + halfWidth
  const maxLeft = Math.max(minLeft, viewport.width - VIEWPORT_MARGIN - halfWidth)
  const left = Math.min(Math.max(idealLeft, minLeft), maxLeft)

  return { top, left }
}
