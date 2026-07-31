import { useEffect, useState, type RefObject } from 'react'
import { usePdfDocument } from '@/modules/reader/pdf/usePdfDocument'
import { PdfPageView, type PdfZoom } from '@/modules/reader/pdf/PdfPageView'
import { PdfPageControls } from '@/modules/reader/pdf/PdfPageControls'
import { SelectionHighlightButton } from '@/modules/reader/components/SelectionHighlightButton'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

export interface PdfReaderViewProps {
  filePath: string
  pageIndex: number
  onPageChange: (index: number) => void
  onPageCountChange: (count: number) => void
  contentRef: RefObject<HTMLDivElement | null>
  onScroll: () => void
  onHighlight: (quote: string) => void
}

/**
 * UX-13.7.1 — the PDF-specific half of the reader (page controls + the
 * canvas/text-layer page view). Deliberately its own module with a default
 * export, lazy-loaded from ReaderPage via React.lazy, so pdfjs-dist — a
 * genuinely large library — only downloads when someone actually opens a
 * PDF in the reader. This mirrors the "heavy per-format code is lazy"
 * convention processing/extractors/registry.ts already established for
 * upload-time extraction; without it, pdfjs-dist would load into every
 * page of the app instead of just the reader.
 */
export default function PdfReaderView({
  filePath,
  pageIndex,
  onPageChange,
  onPageCountChange,
  contentRef,
  onScroll,
  onHighlight,
}: PdfReaderViewProps) {
  const pdfQuery = usePdfDocument(filePath)
  const [zoom, setZoom] = useState<PdfZoom>({ type: 'fit-width' })
  const [resolvedScale, setResolvedScale] = useState(1)

  useEffect(() => {
    if (pdfQuery.data) onPageCountChange(pdfQuery.data.numPages)
  }, [pdfQuery.data, onPageCountChange])

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {pdfQuery.data && (
        <PdfPageControls
          pageIndex={pageIndex}
          pageCount={pdfQuery.data.numPages}
          onPageChange={onPageChange}
          zoom={zoom}
          resolvedScale={resolvedScale}
          onZoomChange={setZoom}
        />
      )}
      <div ref={contentRef} onScroll={onScroll} className="relative flex-1 overflow-auto p-6">
        <SelectionHighlightButton containerRef={contentRef} onHighlight={onHighlight} />
        {pdfQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : pdfQuery.isError || !pdfQuery.data ? (
          <EmptyState title="Couldn't load this PDF" description="Try reloading the page." />
        ) : (
          <PdfPageView pdf={pdfQuery.data} pageIndex={pageIndex} zoom={zoom} onResolvedScaleChange={setResolvedScale} />
        )}
      </div>
    </div>
  )
}
