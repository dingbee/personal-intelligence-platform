import { useFlashcards } from '@/modules/reader/hooks/useFlashcards'
import { FlashcardCard } from '@/modules/reader/components/FlashcardCard'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

export function FlashcardsPanel({
  documentId,
  chapterIndex,
  chapterText,
}: {
  documentId: string
  chapterIndex: number
  chapterText: string
}) {
  const { flashcards, isLoading, generate } = useFlashcards(documentId, chapterIndex)

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-ink)]">Flashcards</h3>
        <Button variant="secondary" loading={generate.isPending} onClick={() => generate.mutate(chapterText)}>
          Generate more
        </Button>
      </div>

      {generate.isError && (
        <p className="mt-2 text-sm text-red-600">
          {generate.error instanceof Error ? generate.error.message : 'Failed to generate flashcards'}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : flashcards.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">No flashcards yet for this chapter.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {flashcards.map((card) => (
            <FlashcardCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}
