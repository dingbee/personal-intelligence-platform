import { openKnowledgeGraphCommand } from '@/modules/commands/commands/knowledgeCommands'
import type { Command } from '@/modules/commands/types'

export type LocalSuggestionId = 'summarize' | 'flashcards' | 'highlights' | 'ask-nova' | 'timeline'

/**
 * UX-9 Phase 7 — two kinds, deliberately: 'command' suggestions reuse a
 * real registry Command (execute(context, actions)), same as UX-8's
 * ActionChips. 'local' suggestions are ReaderPage's own existing tab-
 * switch state (activePanel) — the generic CommandActions bag has no
 * "generate flashcards for chapter N" action and adding one would
 * entangle the global command registry with Reader-local state, so
 * ReaderPage matches on `id` and calls its own existing handlers
 * (setActivePanel) instead of inventing a second action-execution path.
 */
export type ChapterSuggestion =
  | { kind: 'local'; id: LocalSuggestionId; label: string }
  | { kind: 'command'; command: Command; label: string }

export interface ChapterSuggestionsInput {
  hasSummary: boolean
  hasFlashcards: boolean
  highlightCount: number
  /** True once this turn's contextTrace showed graph nodes — same gating recommendationEngine.ts (UX-8/UX-14.1) uses for "Explore knowledge graph." */
  hasGraphContext: boolean
}

/**
 * "Continue Chapter" and "Compare Previous Chapter" from the brief's
 * example list are omitted: the former has no destination (you're
 * already reading it — see readingSignals.ts's chapter_completed/
 * book_nearly_finished for the equivalent informational nudge instead),
 * and the latter has no existing compare/diff capability anywhere in the
 * app (the same gap UX-7/UX-8 already identified for "Compare with
 * previous answer") — building one would be new capability, not reuse.
 */
export function generateChapterSuggestions(input: ChapterSuggestionsInput): ChapterSuggestion[] {
  const suggestions: ChapterSuggestion[] = []

  if (!input.hasSummary) suggestions.push({ kind: 'local', id: 'summarize', label: 'Summarize chapter' })
  if (!input.hasFlashcards) suggestions.push({ kind: 'local', id: 'flashcards', label: 'Generate flashcards' })
  if (input.highlightCount > 0) suggestions.push({ kind: 'local', id: 'highlights', label: 'Review highlights' })

  suggestions.push({ kind: 'local', id: 'ask-nova', label: 'Ask NOVA about this chapter' })

  if (input.hasGraphContext) {
    suggestions.push({ kind: 'command', command: openKnowledgeGraphCommand, label: openKnowledgeGraphCommand.title })
  }

  suggestions.push({ kind: 'local', id: 'timeline', label: 'View timeline' })

  return suggestions
}
