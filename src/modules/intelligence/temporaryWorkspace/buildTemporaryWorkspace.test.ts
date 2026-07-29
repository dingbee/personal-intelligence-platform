import { describe, expect, it } from 'vitest'
import { groupSearchResultsIntoTemporaryWorkspace } from '@/modules/intelligence/temporaryWorkspace/buildTemporaryWorkspace'
import type { SearchResult } from '@/modules/search/types'

function makeResult(overrides: Partial<SearchResult> & { sourceType: string; sourceId: string }): SearchResult {
  return { title: 'title', snippet: 'snippet', similarity: 0.5, href: '/x', ...overrides }
}

describe('groupSearchResultsIntoTemporaryWorkspace', () => {
  it('groups documents and conversations into their own buckets', () => {
    const workspace = groupSearchResultsIntoTemporaryWorkspace('Marketing', [
      makeResult({ sourceType: 'document', sourceId: 'doc-1', title: 'Marketing Plan' }),
      makeResult({ sourceType: 'conversation', sourceId: 'conv-1', title: 'Marketing chat' }),
    ])
    expect(workspace.topic).toBe('Marketing')
    expect(workspace.documents).toHaveLength(1)
    expect(workspace.conversations).toHaveLength(1)
  })

  it('dedupes the same source, keeping the highest-similarity hit', () => {
    const workspace = groupSearchResultsIntoTemporaryWorkspace('Marketing', [
      makeResult({ sourceType: 'document', sourceId: 'doc-1', similarity: 0.4, title: 'First hit' }),
      makeResult({ sourceType: 'document', sourceId: 'doc-1', similarity: 0.9, title: 'Best hit' }),
    ])
    expect(workspace.documents).toHaveLength(1)
    expect(workspace.documents[0]?.title).toBe('Best hit')
  })

  it('ignores source types outside document/conversation without crashing', () => {
    const workspace = groupSearchResultsIntoTemporaryWorkspace('Marketing', [
      makeResult({ sourceType: 'note', sourceId: 'note-1' }),
    ])
    expect(workspace.documents).toEqual([])
    expect(workspace.conversations).toEqual([])
  })

  it('returns empty buckets for no results, with a valid ISO createdAt', () => {
    const workspace = groupSearchResultsIntoTemporaryWorkspace('Marketing', [])
    expect(workspace.documents).toEqual([])
    expect(workspace.conversations).toEqual([])
    expect(new Date(workspace.createdAt).toString()).not.toBe('Invalid Date')
  })
})
