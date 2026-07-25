import type { ReaderChapter } from '@/modules/reader/hooks/useReaderChapters'

export function ChapterNav({
  chapters,
  activeIndex,
  onSelect,
}: {
  chapters: ReaderChapter[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <nav aria-label="Chapters" className="flex h-full w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--color-border)] p-3">
      {chapters.map((chapter) => (
        <button
          key={chapter.index}
          type="button"
          onClick={() => onSelect(chapter.index)}
          className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
            chapter.index === activeIndex
              ? 'bg-[var(--color-canvas)] font-medium text-[var(--color-ink)]'
              : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'
          }`}
        >
          {chapter.title}
        </button>
      ))}
    </nav>
  )
}
