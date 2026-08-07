import { useChapterSummary } from '@/modules/reader/hooks/useChapterSummary'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

export function ChapterSummaryPanel({
  documentId,
  chapterIndex,
  chapterText,
}: {
  documentId: string
  chapterIndex: number
  chapterText: string
}) {
  const { summary, isLoading, generate } = useChapterSummary(documentId, chapterIndex)

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center">
        <p className="text-sm text-[var(--color-ink-muted)]">No summary yet for this chapter.</p>
        <Button
          variant="secondary"
          className="mt-2"
          loading={generate.isPending}
          onClick={() => generate.mutate(chapterText)}
        >
          Summarize this chapter
        </Button>
        {generate.isError && (
          <p className="mt-2 text-sm text-[var(--color-danger)]">
            {generate.error instanceof Error ? generate.error.message : 'Failed to generate summary'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-ink)]">Chapter summary</h3>
        <Button variant="ghost" loading={generate.isPending} onClick={() => generate.mutate(chapterText)}>
          Regenerate
        </Button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink-muted)]">{summary.content}</p>
    </div>
  )
}
