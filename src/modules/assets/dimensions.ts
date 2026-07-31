export type DerivativeKind = 'optimized' | 'thumbnail'

/** Longest-edge target per derivative — aspect ratio is always preserved, so a portrait image's other edge scales down proportionally. */
export const DERIVATIVE_MAX_EDGE: Record<DerivativeKind, number> = {
  optimized: 1920,
  thumbnail: 320,
}

export interface Dimensions {
  width: number
  height: number
}

/**
 * UX-13.8.2 — resize math only, no image decoding: given a source image's
 * natural pixel size, returns the largest size that fits within maxEdge on
 * its longest side while preserving aspect ratio. Never upscales — an
 * image already smaller than the target keeps its natural size, since
 * there's nothing to compress. Pure and unit-testable in isolation from
 * the canvas/File APIs the actual derivative generation needs.
 */
export function computeTargetDimensions(natural: Dimensions, maxEdge: number): Dimensions {
  const longestEdge = Math.max(natural.width, natural.height)
  if (longestEdge <= maxEdge) return { ...natural }

  const scale = maxEdge / longestEdge
  return {
    width: Math.max(1, Math.round(natural.width * scale)),
    height: Math.max(1, Math.round(natural.height * scale)),
  }
}
