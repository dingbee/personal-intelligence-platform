import { describe, expect, it } from 'vitest'
import { generateChapterSuggestions } from '@/modules/reader/intelligence/chapterSuggestions'

const BASE = { hasSummary: true, hasFlashcards: true, highlightCount: 0, hasGraphContext: false }

describe('generateChapterSuggestions', () => {
  it('always suggests asking NOVA and viewing the timeline', () => {
    const suggestions = generateChapterSuggestions(BASE)
    expect(suggestions.some((s) => s.kind === 'local' && s.id === 'ask-nova')).toBe(true)
    expect(suggestions.some((s) => s.kind === 'local' && s.id === 'timeline')).toBe(true)
  })

  it('suggests summarizing only when there is no summary yet', () => {
    expect(generateChapterSuggestions(BASE).some((s) => s.kind === 'local' && s.id === 'summarize')).toBe(false)
    expect(generateChapterSuggestions({ ...BASE, hasSummary: false }).some((s) => s.kind === 'local' && s.id === 'summarize')).toBe(
      true,
    )
  })

  it('suggests flashcards only when none exist yet', () => {
    expect(generateChapterSuggestions(BASE).some((s) => s.kind === 'local' && s.id === 'flashcards')).toBe(false)
    expect(
      generateChapterSuggestions({ ...BASE, hasFlashcards: false }).some((s) => s.kind === 'local' && s.id === 'flashcards'),
    ).toBe(true)
  })

  it('suggests reviewing highlights only when there are some', () => {
    expect(generateChapterSuggestions(BASE).some((s) => s.kind === 'local' && s.id === 'highlights')).toBe(false)
    expect(
      generateChapterSuggestions({ ...BASE, highlightCount: 2 }).some((s) => s.kind === 'local' && s.id === 'highlights'),
    ).toBe(true)
  })

  it('suggests exploring the knowledge graph only when it contributed this turn, reusing the existing command', () => {
    const without = generateChapterSuggestions(BASE)
    expect(without.some((s) => s.kind === 'command')).toBe(false)

    const withGraph = generateChapterSuggestions({ ...BASE, hasGraphContext: true })
    const commandSuggestion = withGraph.find((s) => s.kind === 'command')
    expect(commandSuggestion).toBeDefined()
    expect(commandSuggestion && commandSuggestion.kind === 'command' && commandSuggestion.command.id).toBe('knowledge-explore')
  })
})
