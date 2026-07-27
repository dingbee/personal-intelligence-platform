export type LinkableType = 'note' | 'document' | 'highlight' | 'conversation' | 'flashcard'

export interface LinkableItem {
  type: LinkableType
  id: string
  title: string
  href: string
}

export interface LinkSearchContext {
  userId: string
  workspaceId: string | null
}

/**
 * A pluggable knowledge-graph node type. Mirrors modules/search's
 * SearchProvider registry: a future entity type (e.g. a "project") adds its
 * own table + this interface and registers itself — knowledge_links, the
 * registry, and KnowledgeLinksPanel never change.
 */
export interface LinkResolver {
  /** Also the value stored in knowledge_links.source_type / target_type. */
  id: LinkableType
  /** Resolve a batch of ids to their display item, for rendering existing links. */
  resolve(ids: string[]): Promise<LinkableItem[]>
  /** Search this entity type for the "add link" picker. */
  search(queryText: string, ctx: LinkSearchContext): Promise<LinkableItem[]>
}
