import { describe, expect, it } from 'vitest'
import { ACTION_REGISTRY, getActionDefinition, getActionsForObjectType, isActionSupportedForObjectType } from '@/modules/actions/actionRegistry'

describe('actionRegistry', () => {
  it('has a unique id for every action', () => {
    const ids = ACTION_REGISTRY.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every action supports at least one object type', () => {
    for (const action of ACTION_REGISTRY) {
      expect(action.objectTypes.length).toBeGreaterThan(0)
    }
  })

  it('getActionDefinition returns the matching definition', () => {
    expect(getActionDefinition('delete').label).toBe('Delete')
  })

  it('getActionDefinition throws for an unknown id', () => {
    // @ts-expect-error deliberately invalid id to test the runtime guard
    expect(() => getActionDefinition('nope')).toThrow()
  })

  it('getActionsForObjectType returns only actions that list that type', () => {
    const noteActions = getActionsForObjectType('note').map((a) => a.id)
    expect(noteActions).toContain('delete')
    expect(noteActions).toContain('addToCollection')
    expect(noteActions).toContain('saveAs')
    expect(noteActions).toContain('askNova')
    expect(noteActions).not.toContain('rename')
    expect(noteActions).not.toContain('pin')
  })

  it('pin/favorite/archive/duplicate are conversation-only', () => {
    for (const id of ['pin', 'favorite', 'archive', 'duplicate'] as const) {
      expect(getActionDefinition(id).objectTypes).toEqual(['conversation'])
    }
  })

  it('saveAs covers every object type (full coverage per the discovery audit)', () => {
    const objectTypes: Parameters<typeof isActionSupportedForObjectType>[1][] = [
      'note',
      'document',
      'asset',
      'conversation',
      'knowledge_node',
      'knowledge_collection',
    ]
    for (const type of objectTypes) {
      expect(isActionSupportedForObjectType('saveAs', type)).toBe(true)
    }
  })

  it('delete is marked destructive', () => {
    expect(getActionDefinition('delete').destructive).toBe(true)
  })

  it('rename is not offered for note or knowledge types (documented gap, not a bug)', () => {
    expect(isActionSupportedForObjectType('rename', 'note')).toBe(false)
    expect(isActionSupportedForObjectType('rename', 'knowledge_node')).toBe(false)
    expect(isActionSupportedForObjectType('rename', 'knowledge_collection')).toBe(false)
  })
})
