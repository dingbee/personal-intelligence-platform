import type { Collection } from '@/shared/types/database'

export interface CollectionNode extends Collection {
  children: CollectionNode[]
}

export function buildCollectionTree(collections: Collection[]): CollectionNode[] {
  const nodesById = new Map<string, CollectionNode>(
    collections.map((collection) => [collection.id, { ...collection, children: [] }]),
  )
  const roots: CollectionNode[] = []

  for (const collection of collections) {
    const node = nodesById.get(collection.id)!
    if (collection.parent_id && nodesById.has(collection.parent_id)) {
      nodesById.get(collection.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
