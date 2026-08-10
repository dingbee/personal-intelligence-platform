import { describe, expect, it } from 'vitest'
import { buildCollectionTree } from '@/modules/library/utils/collectionTree'
import type { Collection } from '@/shared/types/database'

function col(overrides: Partial<Collection>): Collection {
  return {
    id: 'c',
    user_id: 'u',
    workspace_id: null,
    parent_id: null,
    name: 'name',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('buildCollectionTree', () => {
  it('nests a child under its parent', () => {
    const tree = buildCollectionTree([
      col({ id: 'root', name: 'Root' }),
      col({ id: 'child', name: 'Child', parent_id: 'root' }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.id).toBe('root')
    expect(tree[0]!.children.map((c) => c.id)).toEqual(['child'])
  })

  it('nests multiple levels deep', () => {
    const tree = buildCollectionTree([col({ id: 'a' }), col({ id: 'b', parent_id: 'a' }), col({ id: 'c', parent_id: 'b' })])
    expect(tree[0]!.children[0]!.children.map((n) => n.id)).toEqual(['c'])
  })

  it('treats a collection whose parent_id points to a non-existent collection as a root, rather than silently dropping it', () => {
    const tree = buildCollectionTree([col({ id: 'orphan', parent_id: 'deleted-parent' })])
    expect(tree.map((n) => n.id)).toEqual(['orphan'])
  })

  it('returns an empty tree for no collections', () => {
    expect(buildCollectionTree([])).toEqual([])
  })

  it('preserves sibling order and does not duplicate a node across levels', () => {
    const tree = buildCollectionTree([
      col({ id: 'root' }),
      col({ id: 'child-1', parent_id: 'root' }),
      col({ id: 'child-2', parent_id: 'root' }),
    ])
    expect(tree[0]!.children.map((c) => c.id)).toEqual(['child-1', 'child-2'])
    // Children are nested, never duplicated at the top level.
    expect(tree.map((n) => n.id)).toEqual(['root'])
  })
})
