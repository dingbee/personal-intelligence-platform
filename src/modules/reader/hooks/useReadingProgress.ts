import { useCallback, useState } from 'react'

interface ReadingProgress {
  chapterIndex: number
  scrollFraction: number
}

/**
 * Local-only for now (not synced to Supabase) — good enough for a single
 * device. Cross-device reading progress is deferred to the fuller EPUB
 * reading workspace milestone alongside AI chat/summary/flashcards per book.
 */
function storageKey(documentId: string): string {
  return `reading-progress:${documentId}`
}

function readProgress(documentId: string): ReadingProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(documentId))
    return raw ? (JSON.parse(raw) as ReadingProgress) : null
  } catch {
    return null
  }
}

export function useReadingProgress(documentId: string) {
  const [progress, setProgress] = useState<ReadingProgress>(
    () => readProgress(documentId) ?? { chapterIndex: 0, scrollFraction: 0 },
  )

  const save = useCallback(
    (next: ReadingProgress) => {
      setProgress(next)
      try {
        localStorage.setItem(storageKey(documentId), JSON.stringify(next))
      } catch {
        // Storage can fail (private browsing, quota) — reading still works, it just won't resume.
      }
    },
    [documentId],
  )

  return { progress, save }
}
