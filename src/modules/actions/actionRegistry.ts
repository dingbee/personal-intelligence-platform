/** The object types every action-bearing surface in the app deals with — matches CollectionItemType (knowledgeCollections.ts) plus 'knowledge_collection' itself. */
export type ActionObjectType = 'note' | 'document' | 'asset' | 'conversation' | 'knowledge_node' | 'knowledge_collection'

export type ActionId = 'open' | 'rename' | 'delete' | 'addToCollection' | 'saveAs' | 'askNova' | 'pin' | 'favorite' | 'archive' | 'duplicate'

export interface ActionDefinition {
  id: ActionId
  /** The canonical label — callers may override per-call (e.g. "Unpin" instead of "Pin", "Restore" instead of "Archive") since several of these are two-state toggles. */
  label: string
  icon: string
  /** Which object types this action is meaningful for *today* — data-driven from the UX-15.4 discovery audit (docs/ux-15.4-action-center-discovery.md §2), not every type gets every action. Extending an action to a type that has no backing field/mutation for it is new work, not registry wiring. */
  objectTypes: ActionObjectType[]
  /** Rendered with DropdownMenuItem's `danger` styling by default. */
  destructive?: boolean
}

/**
 * UX-15.4 Phase 2 — the one place every object action's canonical id/
 * label/icon is declared. Deliberately *not* a hook and does not itself
 * call any mutation: React Query mutations must run inside a component,
 * the same reason the existing Commands system (commandRegistry +
 * useCommandActions) splits static data from live handlers. Each
 * object's own page/card still owns its already-existing mutation hooks
 * (useNotes, useDocumentMutations, useAssets, useConversations, …) and
 * binds them to a `ResolvedAction[]` (see ActionMenu.tsx) — this module
 * only prevents six different files from independently deciding what
 * "Delete" is called or which icon "Rename" gets.
 *
 * `objectTypes` reflects what's real today, not an aspiration:
 * Pin/Favorite/Archive/Duplicate are conversation-only because that's
 * the only object type with `is_pinned`/`favorite`/`archived_at`/a
 * duplicate mutation — generalizing them to other types would be new
 * backend work, which this phase doesn't do (see discovery §6).
 * `askNova`/`rename` intentionally omit `document`/`note` respectively —
 * Document's "Chat with NOVA" is a different, pre-existing mechanism
 * (a document-scoped `?documentId=` link, not `createConversationWithQuery`)
 * and Note has no discrete rename control today; folding either into
 * this registry would be a behavior change, not consolidation.
 */
const ALL_OBJECT_TYPES: ActionObjectType[] = ['note', 'document', 'asset', 'conversation', 'knowledge_node', 'knowledge_collection']

export const ACTION_REGISTRY: ActionDefinition[] = [
  { id: 'open', label: 'Open', icon: '↗️', objectTypes: ALL_OBJECT_TYPES },
  { id: 'rename', label: 'Rename', icon: '✏️', objectTypes: ['document', 'asset', 'conversation'] },
  { id: 'delete', label: 'Delete', icon: '🗑️', objectTypes: ['note', 'document', 'asset', 'conversation', 'knowledge_collection'], destructive: true },
  { id: 'addToCollection', label: 'Add to collection', icon: '📁', objectTypes: ['note', 'document', 'asset', 'conversation', 'knowledge_node'] },
  { id: 'saveAs', label: 'Save As…', icon: '⬇️', objectTypes: ['note', 'document', 'asset', 'conversation', 'knowledge_node', 'knowledge_collection'] },
  { id: 'askNova', label: 'Ask NOVA', icon: '✨', objectTypes: ['note', 'asset', 'conversation', 'knowledge_node', 'knowledge_collection'] },
  { id: 'pin', label: 'Pin', icon: '📌', objectTypes: ['conversation'] },
  { id: 'favorite', label: 'Favorite', icon: '⭐', objectTypes: ['conversation'] },
  { id: 'archive', label: 'Archive', icon: '🗄️', objectTypes: ['conversation'] },
  { id: 'duplicate', label: 'Duplicate', icon: '📄', objectTypes: ['conversation'] },
]

const BY_ID = new Map(ACTION_REGISTRY.map((action) => [action.id, action]))

export function getActionDefinition(id: ActionId): ActionDefinition {
  const definition = BY_ID.get(id)
  if (!definition) throw new Error(`Unknown action id: ${id}`)
  return definition
}

export function getActionsForObjectType(objectType: ActionObjectType): ActionDefinition[] {
  return ACTION_REGISTRY.filter((action) => action.objectTypes.includes(objectType))
}

export function isActionSupportedForObjectType(id: ActionId, objectType: ActionObjectType): boolean {
  return getActionDefinition(id).objectTypes.includes(objectType)
}
