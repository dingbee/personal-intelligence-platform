import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useReaderChapters } from '@/modules/reader/hooks/useReaderChapters'
import { useReadingProgress } from '@/modules/reader/hooks/useReadingProgress'
import { useHighlights } from '@/modules/reader/hooks/useHighlights'
import { ChapterNav } from '@/modules/reader/components/ChapterNav'
import { SelectionHighlightButton } from '@/modules/reader/components/SelectionHighlightButton'
import { HighlightsList } from '@/modules/reader/components/HighlightsList'
import { ChapterSummaryPanel } from '@/modules/reader/components/ChapterSummaryPanel'
import { FlashcardsPanel } from '@/modules/reader/components/FlashcardsPanel'
import { ReaderChatPanel } from '@/modules/reader/components/ReaderChatPanel'
import { resolveReaderMode } from '@/modules/reader/resolveReaderMode'
import type { LocalSuggestionId } from '@/modules/reader/intelligence/chapterSuggestions'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

// UX-13.7.1 — lazy-loaded so pdfjs-dist (a genuinely large library) only
// downloads when someone actually opens a PDF, not on every page of the
// app. See PdfReaderView's header comment.
const PdfReaderView = lazy(() => import('@/modules/reader/pdf/PdfReaderView'))
// UX-13 Phase B — same reasoning: SheetJS only downloads when someone
// actually opens a spreadsheet. See SpreadsheetReaderView's header comment.
const SpreadsheetReaderView = lazy(() => import('@/modules/reader/spreadsheet/SpreadsheetReaderView'))

type SidePanelTab = 'chat' | 'summary' | 'flashcards' | 'highlights'
/**
 * Unifies "which panel is showing" into one value instead of two
 * independent flags. On desktop this only ever matters for the AI aside —
 * Chapters stays permanently visible there regardless of this state. On
 * mobile it's exclusive: at most one of {chapters, an AI tab} is active at
 * a time, and `null` (neither) is what gives the reading pane full width —
 * i.e. Reading Focus Mode falls out of this for free, it isn't a separate
 * boolean.
 */
type ActivePanel = 'chapters' | SidePanelTab

const LOCAL_SUGGESTION_TABS: Record<LocalSuggestionId, SidePanelTab> = {
  summarize: 'summary',
  flashcards: 'flashcards',
  highlights: 'highlights',
  'ask-nova': 'chat',
  timeline: 'chat',
}

const TABS: { id: SidePanelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'summary', label: 'Summary' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'highlights', label: 'Highlights' },
]

export function ReaderPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { document, chapters, isLoading: chaptersLoading, isError } = useReaderChapters(documentId!)
  const { progress, hasProgress, updatedAt: progressUpdatedAt, isLoading: progressLoading, save } = useReadingProgress(documentId!)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollSaveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  // UX-13.8.1 — resolveReaderMode is the single "is this document readable,
  // and how" decision; DocumentCard's Read button/menu item make the same
  // call before ever linking here.
  const readerMode = document ? resolveReaderMode(document.file_type) : null
  const isPdf = readerMode === 'pdf'
  const isSpreadsheet = readerMode === 'spreadsheet'
  // UX-13.7.1 — populated by PdfReaderView once it (lazily) loads the PDF
  // and knows its real page count; 0 until then.
  const [pdfPageCount, setPdfPageCount] = useState(0)
  // UX-13 Phase B — same idea, populated by SpreadsheetReaderView once it
  // (lazily) loads the workbook and knows its real sheet count.
  const [sheetCount, setSheetCount] = useState(0)

  const isLoading = chaptersLoading || progressLoading

  // Only set the initial chapter once, after reading progress has loaded —
  // avoids a visible jump from chapter 0 to the saved chapter on open.
  // UX-7 Phase 4: a `?chapter=` param (from a reference chip / "Read
  // Chapter 4" deep link) wins over saved progress — it's an explicit
  // destination, not a resume point. Stripped from the URL immediately so
  // it doesn't fight manual chapter navigation afterwards or re-trigger on
  // a later remount. UX-13.7.1: for a PDF, the same chapter_index field
  // stores the current *page* instead — same "resume where you left off"
  // contract, just a different unit.
  useEffect(() => {
    if (activeIndex !== null || progressLoading) return
    const chapterParam = searchParams.get('chapter')
    const requestedChapter = chapterParam !== null ? Number.parseInt(chapterParam, 10) : null
    setActiveIndex(requestedChapter !== null && !Number.isNaN(requestedChapter) ? requestedChapter : progress.chapterIndex)
    if (chapterParam !== null) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.delete('chapter')
          return next
        },
        { replace: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressLoading])

  // UX-13.8.1 — a `?panel=summary` deep link (from DocumentCard's
  // Summarize menu item) opens straight to that side panel instead of
  // requiring a click once the reader loads. Same "consume once, strip
  // from the URL" contract as `?chapter=` above — this only needs to run
  // once on mount, not re-check on every activePanel change.
  useEffect(() => {
    const panelParam = searchParams.get('panel')
    if (panelParam === null) return
    if (TABS.some((tab) => tab.id === panelParam)) setActivePanel(panelParam as SidePanelTab)
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('panel')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = contentRef.current
    if (el && activeIndex !== null) el.scrollTop = el.scrollHeight * progress.scrollFraction
    // Only restore scroll position on chapter change — deliberately not
    // depending on progress.scrollFraction, which updates continuously as
    // the reader scrolls and would otherwise fight the user's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  const { add: addHighlight } = useHighlights(documentId!, activeIndex ?? 0)

  function handleScroll() {
    const el = contentRef.current
    if (!el || activeIndex === null) return
    const maxScroll = el.scrollHeight - el.clientHeight
    const scrollFraction = maxScroll > 0 ? el.scrollTop / maxScroll : 0
    clearTimeout(scrollSaveTimeout.current)
    scrollSaveTimeout.current = setTimeout(() => save({ chapterIndex: activeIndex, scrollFraction }), 300)
  }

  function goToChapter(index: number) {
    setActiveIndex(index)
    save({ chapterIndex: index, scrollFraction: 0 })
    // On mobile, picking a chapter should return to the reading view rather
    // than leaving the (now full-width, on mobile) chapters panel open over
    // the content the user just navigated to. No effect on desktop, where
    // this state never controls the chapters panel's visibility.
    setActivePanel(null)
  }

  // UX-9 Phase 10 — ReaderIntelligencePanel's chapter suggestions are
  // reader-local (they need chapter content as a payload, which no
  // registry Command execute signature supports), so they're routed
  // through the tab-switching state ReaderPage already owns rather than
  // the global command registry.
  function handleLocalSuggestion(id: LocalSuggestionId) {
    setActivePanel(LOCAL_SUGGESTION_TABS[id])
  }

  if (isLoading || activeIndex === null) {
    return (
      <div className="flex h-screen h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !document || !chapters) {
    return (
      <div className="p-8">
        <EmptyState title="Couldn't load this document" description="It may have been deleted or is still processing." />
      </div>
    )
  }

  if (readerMode === null) {
    return (
      <div className="p-8">
        <EmptyState
          title="Reader coming soon for this file type"
          description="The reading workspace currently supports PDF, EPUB, DOCX, plain text, and Markdown."
        />
      </div>
    )
  }

  // UX-13.7.1 — when the PDF was processed (or reprocessed) after this
  // phase shipped, document_chunks are page-aligned 1:1 with the PDF's
  // real pages (see pdf.ts's per-page chapters), so the section shown in
  // the side panel can track the visible page exactly. A PDF processed
  // before this phase falls back to groupChunksIntoChapters's single
  // "Full text" section (index 0) — chat/highlights/notes still work,
  // just scoped to the whole document rather than one page, until the
  // document is reprocessed.
  const pdfPageAligned = isPdf && pdfPageCount > 0 && chapters.length === pdfPageCount
  // UX-13 Phase B — same "document_chunks aligned 1:1 with the real
  // units" fallback as PDF's above: spreadsheet.ts's per-sheet chapters
  // give exact alignment for any file processed after this phase; a
  // spreadsheet processed before it falls back to the single "Full text"
  // section until reprocessed.
  const sheetAligned = isSpreadsheet && sheetCount > 0 && chapters.length === sheetCount
  const sectionIndex = isPdf ? (pdfPageAligned ? activeIndex : 0) : isSpreadsheet ? (sheetAligned ? activeIndex : 0) : activeIndex
  const activeChapter = chapters.find((chapter) => chapter.index === sectionIndex) ?? chapters[0]
  const pageCount = isPdf ? pdfPageCount : isSpreadsheet ? sheetCount : chapters.length
  const progressPercent = pageCount > 0 ? ((activeIndex + 1) / pageCount) * 100 : 0
  const positionLabel = isPdf ? 'Page' : isSpreadsheet ? 'Sheet' : 'Chapter'

  return (
    <div className="flex h-screen h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--color-border)] px-4">
        <Link to="/library" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Library
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-ink)]" title={document.title}>
          {document.title}
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-3 overflow-x-auto text-xs text-[var(--color-ink-muted)]">
          {/* Chapter/page counter + progress bar dropped below md — on a
              narrow phone there isn't room for them alongside the tab
              buttons (including the mobile-only Chapters toggle below),
              and they're not needed to operate the reader. */}
          {pageCount > 0 && (
            <span className="hidden md:inline">
              {positionLabel} {activeIndex + 1} of {pageCount}
            </span>
          )}
          <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-[var(--color-canvas)] md:block">
            <div className="h-full bg-[var(--color-accent)]" style={{ width: `${progressPercent}%` }} />
          </div>
          {/* Mobile-only: desktop always shows ChapterNav, so a toggle for
              it there would be redundant. Not shown for PDF — v1 has no
              chapter/thumbnail list to toggle (see PdfPageControls'
              prev/next + jump-to-page instead). Not shown for spreadsheets
              either — WorkbookNav's sheet tabs are already always visible,
              same reasoning as PDF. */}
          {!isPdf && !isSpreadsheet && (
            <button
              type="button"
              onClick={() => setActivePanel(activePanel === 'chapters' ? null : 'chapters')}
              className={`rounded-md px-2 py-1 font-medium md:hidden ${
                activePanel === 'chapters'
                  ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]'
                  : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              Chapters
            </button>
          )}
          {/* Highlights dropped for spreadsheets — a grid cell isn't a
              passage of prose to select, see SpreadsheetReaderView's
              header comment. */}
          {TABS.filter((tab) => !(isSpreadsheet && tab.id === 'highlights')).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePanel(activePanel === tab.id ? null : tab.id)}
              className={`rounded-md px-2 py-1 font-medium ${
                activePanel === tab.id
                  ? 'bg-[var(--color-ink)] text-[var(--color-canvas)]'
                  : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!isPdf && !isSpreadsheet && (
          // Desktop: always visible, exactly as before (md:flex, ignores
          // activePanel entirely). Mobile: only when the Chapters toggle is
          // active — otherwise it would still eat width from the reading
          // pane even with no AI panel open, which was the root of the
          // reported issue.
          <div className={`h-full ${activePanel === 'chapters' ? 'flex' : 'hidden md:flex'}`}>
            <ChapterNav chapters={chapters} activeIndex={activeIndex} onSelect={goToChapter} />
          </div>
        )}

        {isPdf ? (
          <div className={`flex min-w-0 flex-1 flex-col ${activePanel !== null ? 'hidden md:flex' : ''}`}>
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <PdfReaderView
                filePath={document.file_path}
                pageIndex={activeIndex}
                onPageChange={goToChapter}
                onPageCountChange={setPdfPageCount}
                contentRef={contentRef}
                onScroll={handleScroll}
                onHighlight={(quote) => addHighlight.mutate(quote)}
              />
            </Suspense>
          </div>
        ) : isSpreadsheet ? (
          <div className={`flex min-w-0 flex-1 flex-col ${activePanel !== null ? 'hidden md:flex' : ''}`}>
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <SpreadsheetReaderView
                filePath={document.file_path}
                sheetIndex={activeIndex}
                onSheetChange={goToChapter}
                onSheetCountChange={setSheetCount}
              />
            </Suspense>
          </div>
        ) : (
          // Desktop: always visible alongside whichever AI tab is open, as
          // before. Mobile: hidden whenever any panel (chapters or an AI
          // tab) is active, so that panel gets the full viewport instead of
          // being squeezed — this is what makes activePanel === null give
          // the reading pane maximum width by default.
          <div
            ref={contentRef}
            onScroll={handleScroll}
            className={`flex-1 overflow-y-auto ${activePanel !== null ? 'hidden md:block' : ''}`}
          >
            <SelectionHighlightButton containerRef={contentRef} onHighlight={(quote) => addHighlight.mutate(quote)} />
            <article className="mx-auto max-w-[68ch] px-6 py-12">
              <h2 className="mb-6 text-2xl font-semibold text-[var(--color-ink)]">{activeChapter?.title}</h2>
              <div className="flex flex-col gap-4 text-base leading-relaxed text-[var(--color-ink)]">
                {activeChapter?.content.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>)}
              </div>

              <div className="mt-12 flex justify-between border-t border-[var(--color-border)] pt-6 text-sm">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => goToChapter(activeIndex - 1)}
                  className="text-[var(--color-accent)] hover:underline disabled:pointer-events-none disabled:text-[var(--color-ink-muted)]"
                >
                  ← Previous chapter
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= chapters.length - 1}
                  onClick={() => goToChapter(activeIndex + 1)}
                  className="text-[var(--color-accent)] hover:underline disabled:pointer-events-none disabled:text-[var(--color-ink-muted)]"
                >
                  Next chapter →
                </button>
              </div>
            </article>
          </div>
        )}

        {/* Desktop: fixed w-96 sidebar, same as before. Mobile: full width
            — a phone only ever shows one panel at a time, so there's no
            reason to give this less than the whole viewport either. */}
        {activePanel !== 'chapters' && activePanel !== null && (
          <aside className="w-full shrink-0 overflow-y-auto border-l border-[var(--color-border)] md:w-96">
            {activePanel === 'chat' && (
              <ReaderChatPanel
                documentId={documentId!}
                documentTitle={document.title}
                workspaceId={document.workspace_id}
                chapters={chapters}
                activeChapterIndex={sectionIndex}
                scrollFraction={progress.scrollFraction}
                hasProgress={hasProgress}
                progressUpdatedAt={progressUpdatedAt}
                onLocalSuggestion={handleLocalSuggestion}
                isSpreadsheet={isSpreadsheet}
              />
            )}
            {activePanel === 'summary' && activeChapter && (
              <div className="p-4">
                <ChapterSummaryPanel
                  documentId={documentId!}
                  chapterIndex={activeChapter.index}
                  chapterText={activeChapter.content}
                />
              </div>
            )}
            {activePanel === 'flashcards' && activeChapter && (
              <div className="p-4">
                <FlashcardsPanel
                  documentId={documentId!}
                  chapterIndex={activeChapter.index}
                  chapterText={activeChapter.content}
                />
              </div>
            )}
            {activePanel === 'highlights' && (
              <div className="p-4">
                <h3 className="mb-3 text-sm font-medium text-[var(--color-ink)]">
                  Highlights {isPdf ? 'on this page' : 'in this chapter'}
                </h3>
                <HighlightsList
                  documentId={documentId!}
                  chapterIndex={activeIndex}
                  chunkIds={activeChapter?.chunkIds ?? []}
                />
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
