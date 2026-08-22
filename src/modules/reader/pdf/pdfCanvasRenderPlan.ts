const MAX_DEVICE_PIXEL_RATIO = 2

export interface PdfCanvasRenderPlan {
  /** CSS pixel size — the page's visual size never changes with DPR. */
  cssWidth: number
  cssHeight: number
  /** Canvas backing-store resolution — cssWidth/cssHeight × dpr, so physical pixels scale with device density. */
  canvasWidth: number
  canvasHeight: number
  /** The (possibly capped) device pixel ratio actually used, for the PDF.js render transform. */
  dpr: number
}

/**
 * High-DPI canvas math for PdfPageView: the CSS box stays exactly the
 * logical viewport size (so Fit Width/zoom math and text-layer alignment
 * are unaffected), while the backing bitmap is rendered at devicePixelRatio
 * more pixels so the page isn't blurrily upscaled on retina/high-density
 * screens. Capped at 2x — high enough for genuine sharpness on every
 * mainstream device (including 3x phones, where the human eye can't
 * resolve the extra density on typical document text/line art) while
 * keeping backing-store memory bounded for large pages.
 */
export function computeCanvasRenderPlan(viewportWidth: number, viewportHeight: number, devicePixelRatio: number): PdfCanvasRenderPlan {
  const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), MAX_DEVICE_PIXEL_RATIO)
  return {
    cssWidth: viewportWidth,
    cssHeight: viewportHeight,
    canvasWidth: Math.round(viewportWidth * dpr),
    canvasHeight: Math.round(viewportHeight * dpr),
    dpr,
  }
}
