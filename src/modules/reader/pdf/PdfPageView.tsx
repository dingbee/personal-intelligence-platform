import { useEffect, useRef, useState } from 'react'
import { TextLayer } from 'pdfjs-dist'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { computeCanvasRenderPlan } from '@/modules/reader/pdf/pdfCanvasRenderPlan'

export type PdfZoom = { type: 'fit-width' } | { type: 'scale'; value: number }

export interface PdfPageViewProps {
  pdf: PDFDocumentProxy
  pageIndex: number
  zoom: PdfZoom
  /** Reports the scale actually used to render (needed by the zoom control to show a percentage even in "fit width" mode, where the scale is computed here from the container's measured width). */
  onResolvedScaleChange?: (scale: number) => void
}

/**
 * UX-13.7.1 — renders one PDF page: a canvas (visual fidelity) plus a
 * transparent, absolutely-positioned text layer on top (pdfjs-dist's
 * TextLayer) so the page is real selectable/searchable text, not just a
 * picture — that's what lets SelectionHighlightButton (already generic,
 * built for EPUB's reflowed text) work here completely unmodified.
 *
 * "Fit width" measures the wrapping container via ResizeObserver and
 * computes scale = containerWidth / the page's natural (scale=1) width,
 * re-fitting whenever the container resizes (e.g. the side panel opens).
 */
export function PdfPageView({ pdf, pageIndex, zoom, onResolvedScaleChange }: PdfPageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (zoom.type === 'fit-width' && containerWidth === 0) return

    let cancelled = false
    let renderTask: RenderTask | null = null

    async function renderPage() {
      const page = await pdf.getPage(pageIndex + 1)
      if (cancelled) return

      const scale = zoom.type === 'scale' ? zoom.value : containerWidth / page.getViewport({ scale: 1 }).width
      onResolvedScaleChange?.(scale)

      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      const textLayerEl = textLayerRef.current
      if (!canvas || !textLayerEl || cancelled) return

      // High-DPI rendering: the canvas's CSS box stays exactly the logical
      // viewport size (so the text layer below, Fit Width math, and zoom
      // percentages are unaffected), but its backing bitmap is rendered at
      // devicePixelRatio more pixels via the render `transform`, so retina/
      // high-density screens don't get a blurry upscale of a low-res canvas.
      const plan = computeCanvasRenderPlan(viewport.width, viewport.height, window.devicePixelRatio || 1)
      canvas.width = plan.canvasWidth
      canvas.height = plan.canvasHeight
      canvas.style.width = `${plan.cssWidth}px`
      canvas.style.height = `${plan.cssHeight}px`

      renderTask = page.render({ canvas, viewport, transform: [plan.dpr, 0, 0, plan.dpr, 0, 0] })
      await renderTask.promise
      if (cancelled) return

      textLayerEl.replaceChildren()
      textLayerEl.style.width = `${plan.cssWidth}px`
      textLayerEl.style.height = `${plan.cssHeight}px`
      const textContent = await page.getTextContent()
      if (cancelled) return
      await new TextLayer({ textContentSource: textContent, container: textLayerEl, viewport }).render()
    }

    void renderPage().catch(() => {
      // A cancelled render task's promise rejects too — a page the user has
      // already navigated away from, not a real error worth surfacing.
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdf, pageIndex, zoom, containerWidth, onResolvedScaleChange])

  return (
    <div ref={containerRef} className="mx-auto flex w-full justify-center">
      <div className="relative inline-block shadow-raised">
        <canvas ref={canvasRef} className="block" />
        <div ref={textLayerRef} className="pdf-text-layer absolute left-0 top-0" />
      </div>
    </div>
  )
}
