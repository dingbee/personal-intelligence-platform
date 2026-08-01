import { describe, expect, it } from 'vitest'
import { resolveSourceItems } from '@/modules/knowledge-intelligence/api/sourceResolution'

describe('resolveSourceItems', () => {
  it('attaches a label when the lookup resolves it', () => {
    const result = resolveSourceItems(
      [{ type: 'document', id: 'doc-1' }],
      (type, id) => (type === 'document' && id === 'doc-1' ? 'Atomic Habits' : undefined),
    )
    expect(result).toEqual([{ type: 'document', id: 'doc-1', label: 'Atomic Habits' }])
  })

  it('drops items the lookup cannot resolve (e.g. a deleted source), without throwing', () => {
    const result = resolveSourceItems(
      [
        { type: 'document', id: 'doc-1' },
        { type: 'note', id: 'note-deleted' },
      ],
      (type) => (type === 'document' ? 'Atomic Habits' : undefined),
    )
    expect(result).toEqual([{ type: 'document', id: 'doc-1', label: 'Atomic Habits' }])
  })

  it('preserves extra fields on each item alongside the resolved label', () => {
    const result = resolveSourceItems(
      [{ type: 'note', id: 'note-1', createdAt: '2026-01-01T00:00:00.000Z' }],
      () => 'My note',
    )
    expect(result).toEqual([{ type: 'note', id: 'note-1', createdAt: '2026-01-01T00:00:00.000Z', label: 'My note' }])
  })

  it('returns an empty array for an empty input, and calls the lookup once per item in order', () => {
    expect(resolveSourceItems([], () => 'unused')).toEqual([])

    const calls: Array<[string, string]> = []
    resolveSourceItems(
      [
        { type: 'document', id: 'a' },
        { type: 'note', id: 'b' },
      ],
      (type, id) => {
        calls.push([type, id])
        return 'x'
      },
    )
    expect(calls).toEqual([
      ['document', 'a'],
      ['note', 'b'],
    ])
  })

  it('disambiguates by both type and id, not id alone — a lookup keyed on `${type}:${id}` behaves correctly even if two different types share an id string', () => {
    const titleByTypeAndId = new Map([
      ['document:shared-id', 'Document Title'],
      ['note:shared-id', 'Note Title'],
    ])
    const result = resolveSourceItems(
      [
        { type: 'document', id: 'shared-id' },
        { type: 'note', id: 'shared-id' },
      ],
      (type, id) => titleByTypeAndId.get(`${type}:${id}`),
    )
    expect(result).toEqual([
      { type: 'document', id: 'shared-id', label: 'Document Title' },
      { type: 'note', id: 'shared-id', label: 'Note Title' },
    ])
  })
})
