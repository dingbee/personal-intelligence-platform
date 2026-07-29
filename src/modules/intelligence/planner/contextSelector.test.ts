import { describe, expect, it } from 'vitest'
import { selectContext } from '@/modules/intelligence/planner/contextSelector'

describe('selectContext', () => {
  it('includes exactly the required sources', () => {
    const result = selectContext(['documents', 'knowledge_graph'])
    expect(result.included).toEqual(['documents', 'knowledge_graph'])
  })

  it('skips every source not required', () => {
    const result = selectContext(['documents'])
    expect(result.skipped).not.toContain('documents')
    expect(result.skipped).toContain('reading_progress')
    expect(result.skipped).toContain('memory')
  })

  it('included and skipped never overlap', () => {
    const result = selectContext(['notes', 'flashcards'])
    const overlap = result.included.filter((source) => result.skipped.includes(source))
    expect(overlap).toEqual([])
  })

  it('included and skipped together cover every known context source', () => {
    const result = selectContext(['memory'])
    expect(result.included.length + result.skipped.length).toBe(8)
  })

  it('skips everything when nothing is required', () => {
    const result = selectContext([])
    expect(result.included).toEqual([])
    expect(result.skipped).toHaveLength(8)
  })

  it('includes everything when everything is required', () => {
    const result = selectContext([
      'documents', 'reading_progress', 'notes', 'flashcards', 'memory', 'knowledge_graph', 'recent_conversations', 'workspace_overview',
    ])
    expect(result.skipped).toEqual([])
  })
})
