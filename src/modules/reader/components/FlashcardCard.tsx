import { useState } from 'react'
import type { Flashcard } from '@/shared/types/database'

export function FlashcardCard({ card }: { card: Flashcard }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setRevealed((value) => !value)}
      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-accent)]"
    >
      <span className="text-xs font-medium text-[var(--color-ink-muted)]">{revealed ? 'Answer' : 'Question'}</span>
      <p className="mt-1 text-sm text-[var(--color-ink)]">{revealed ? card.back : card.front}</p>
      <span className="mt-2 block text-xs text-[var(--color-ink-muted)]">
        {revealed ? 'Click to see question' : 'Click to reveal answer'}
      </span>
    </button>
  )
}
