import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useReaderChapters } from '@/modules/reader/hooks/useReaderChapters'
import { useReadingProgress } from '@/modules/reader/hooks/useReadingProgress'
import { useHighlights } from '@/modules/reader/hooks/useHighlights'
import { ChapterNav } from '@/modules/reader/components/ChapterNav'
import { SelectionHighlightButton } from '@/modules/reader/components/SelectionHighlightButton'
import { HighlightsList } from '@/modules/reader/components/HighlightsList'
import { ChapterSummaryPanel } from '@/modules/reader/components/ChapterSummaryPanel'
import { FlashcardsPanel } from '@/modules/reader/components/FlashcardsPanel'
import { ReaderChatPanel } from '@/modules/reader/components/ReaderChatPanel'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

type SidePanelTab = 'chat' | 'summary' | 'flashcards' | 'highlights'

const TABS: { id: SidePanelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'summary', label: 'Summary' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'highlights', label: 'Highlights' },
]

export function ReaderPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const { document, chapters, isLoading: chaptersLoading, isError } = useReaderChapters(documentId!)
  const { progress, isLoading: progressLoading, save } = useReadingProgress(documentId!)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [openTab, setOpenTab] = useState<SidePanelTab | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollSaveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const isLoading = chaptersLoading || progressLoading

  // Only set the initial chapter once, after reading progress has loaded —
  // avoids a visible jump from chapter 0 to the saved chapter on open.
  useEffect(() => {
    if (activeIndex === null && !progressLoading) setActiveIndex(progress.chapterIndex)
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
          <span>
            Chapter {activeIndex + 1} of {chapters.length}
          </span>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div className="h-full bg-[var(--color-accent)]" style={{ width: `${progressPercent}%` }} />
          </div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOpenTab(openTab === tab.id ? null : tab.id)}
              className={`rounded-md px-2 py-1 font-medium ${
                openTab === tab.id
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
        <ChapterNav chapters={chapters} activeIndex={activeIndex} onSelect={goToChapter} />

        <div ref={contentRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
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

        {openTab && (
          <aside className="w-96 shrink-0 overflow-y-auto border-l border-[var(--color-border)]">
            {openTab === 'chat' && <ReaderChatPanel documentId={documentId!} />}
            {openTab === 'summary' && activeChapter && (
              <div className="p-4">
                <ChapterSummaryPanel
                  documentId={documentId!}
                  chapterIndex={activeChapter.index}
                  chapterText={activeChapter.content}
                />
              </div>
            )}
            {openTab === 'flashcards' && activeChapter && (
              <div className="p-4">
                <FlashcardsPanel
                  documentId={documentId!}
                  chapterIndex={activeChapter.index}
                  chapterText={activeChapter.content}
                />
              </div>
            )}
            {openTab === 'highlights' && (
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
