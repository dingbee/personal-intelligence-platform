import type { KnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/knowledgeNodePackageTypes'
import type { NotePackage } from '@/modules/knowledge-exchange/notes/notePackageTypes'
import type { AssetPackage } from '@/modules/knowledge-exchange/assets/assetPackageTypes'
import type { DocumentPackageManifest } from '@/modules/knowledge-exchange/documents/documentPackageTypes'
import type { KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'
import type { ConversationPackage } from '@/modules/knowledge-exchange/conversations/conversationPackageTypes'

/**
 * UX-14.5.10.6 — the one, versioned shape a Knowledge Collection export/
 * import package takes, per `docs/ux-14.5.10.5-knowledge-collection-
 * exchange-discovery.md` §1. This is the highest-level package type: it
 * embeds every other package type verbatim as member payloads rather than
 * inventing per-type export/import logic of its own — the discovery's
 * central finding (§0/§4).
 *
 * `memberType` is a discriminated union over the real `CollectionItemType`s
 * (`knowledgeCollections.ts`), minus nothing — `knowledge_link` was never a
 * valid member type in the first place (§0), so there's no fifth "link"
 * case to add here.
 *
 * `document` is the one case whose `payload` is JSON but whose *content*
 * isn't — a Document package is itself a `.zip` (UX-14.5.10.3.1), so this
 * entry only carries the JSON manifest half; `archiveEntry` names the
 * nested zip entry (`document-members/<n>.zip`, see
 * `collectionPackageArchive.ts`) that carries that member's own original
 * file bytes, unmodified.
 *
 * `conversation` (UX-14.5.12) embeds a real, unmodified
 * `ConversationPackage` verbatim, the same "no per-type export/import
 * logic, only orchestration" discipline every other member type already
 * follows — Conversation Exchange having since been built closed the gap
 * that previously forced this case to be an honest `unsupported: true`
 * stub.
 *
 * `originalAddedAt` is the membership link's own `created_at`, preserved
 * as inert display metadata only — never used to reconstruct any real
 * ordering (§1.2: no ordering concept exists in this product today).
 */
export type CollectionMemberEntry =
  | { memberType: 'knowledge_node'; originalAddedAt: string; payload: KnowledgeNodePackage }
  | { memberType: 'note'; originalAddedAt: string; payload: NotePackage }
  | { memberType: 'asset'; originalAddedAt: string; payload: AssetPackage }
  | { memberType: 'document'; originalAddedAt: string; payload: DocumentPackageManifest; archiveEntry: string }
  | { memberType: 'conversation'; originalAddedAt: string; payload: ConversationPackage }

export type CollectionMemberType = CollectionMemberEntry['memberType']

/**
 * `relationships` is the auxiliary, non-membership payload the discovery's
 * §2.6 calls for: `knowledge_links` edges where *both* endpoints are among
 * this collection's own `knowledge_node` members — not a new membership
 * type, a bonus record of structure the members already imply. Each entry
 * is an unmodified `KnowledgeLinkPackage` (UX-14.5.10.4), replayed through
 * the existing, unmodified `importKnowledgeLinkPackage` after every
 * `knowledge_node` member resolves (§3.3).
 */
export interface CollectionPackageManifest {
  version: number
  exportedAt: string
  sourceVersion: string
  collection: {
    name: string
    description: string | null
    members: CollectionMemberEntry[]
    relationships: KnowledgeLinkPackage[]
  }
}
