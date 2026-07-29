import { useEffect, useRef, useState } from 'react'
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
import type { LocalSuggestionId } from '@/modules/reader/intelligence/chapterSuggestions'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

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

  const isLoading = chaptersLoading || progressLoading

  // Only set the initial chapter once, after reading progress has loaded —
  // avoids a visible jump from chapter 0 to the saved chapter on open.
  // UX-7 Phase 4: a `?chapter=` param (from a reference chip / "Read
  // Chapter 4" deep link) wins over saved progress — it's an explicit
  // destination, not a resume point. Stripped from the URL immediately so
  // it doesn't fight manual chapter navigation afterwards or re-trigger on
  // a later remount.
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
      <div className="flex h-screen items-center justify-center">
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

  if (document.file_type !== 'epub') {
    return (
      <div className="p-8">
        <EmptyState
          title="Reader coming soon for this file type"
          description="The reading workspace currently supports EPUB. Other formats arrive in a later milestone."
        />
      </div>
    )
  }

  const activeChapter = chapters.find((chapter) => chapter.index === activeIndex) ?? chapters[0]
  const progressPercent = chapters.length > 0 ? ((activeIndex + 1) / chapters.length) * 100 : 0

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--color-border)] px-4">
        <Link to="/library" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Library
        </Link>
        <h1 className="truncate text-sm font-medium text-[var(--color-ink)]">{document.title}</h1>
        <div className="ml-auto flex items-center gap-3 text-xs text-[var(--color-ink-muted)]">
          {/* Chapter counter + progress bar dropped below md — on a narrow
              phone there isn't room for them alongside the tab buttons
              (including the new mobile-only Chapters toggle below), and
              they're not needed to operate the reader. */}
          <span className="hidden md:inline">
            Chapter {activeIndex + 1} of {chapters.length}
          </span>
          <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-[var(--color-canvas)] md:block">
            <div className="h-full bg-[var(--color-accent)]" style={{ width: `${progressPercent}%` }} />
          </div>
          {/* Mobile-only: desktop always shows ChapterNav, so a toggle for
              it there would be redundant. */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'chapters' ? null : 'chapters')}
            className={`rounded-md px-2 py-1 font-medium md:hidden ${
              activePanel === 'chapters'
                ? 'bg-[var(--color-ink)] text-white'
                : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            Chapters
          </button>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePanel(activePanel === tab.id ? null : tab.id)}
              className={`rounded-md px-2 py-1 font-medium ${
                activePanel === tab.id
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop: always visible, exactly as before (md:flex, ignores
            activePanel entirely). Mobile: only when the Chapters toggle is
            active — otherwise it would still eat width from the reading
            pane even with no AI panel open, which was the root of the
            reported issue. */}
        <div className={`h-full ${activePanel === 'chapters' ? 'flex' : 'hidden md:flex'}`}>
          <ChapterNav chapters={chapters} activeIndex={activeIndex} onSelect={goToChapter} />
        </div>

        {/* Desktop: always visible alongside whichever AI tab is open, as
            before. Mobile: hidden whenever any panel (chapters or an AI
            tab) is active, so that panel gets the full viewport instead of
            being squeezed — this is what makes activePanel === null give
            the reading pane maximum width by default. */}
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
                activeChapterIndex={activeIndex}
                scrollFraction={progress.scrollFraction}
                hasProgress={hasProgress}
                progressUpdatedAt={progressUpdatedAt}
                onLocalSuggestion={handleLocalSuggestion}
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
                <h3 className="mb-3 text-sm font-medium text-[var(--color-ink)]">Highlights in this chapter</h3>
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
