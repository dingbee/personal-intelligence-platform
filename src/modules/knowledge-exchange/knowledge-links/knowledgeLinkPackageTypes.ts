import type { KnowledgeNodeType } from '@/shared/types/database'

/**
 * UX-14.5.10.4 — the one, versioned shape a Knowledge Link export/import
 * package takes. Allow-list, matching every other package type's own
 * discipline: only the fields listed here can ever leave a relationship
 * in a package.
 *
 * A link is only meaningful with both its endpoints present — unlike
 * every prior package type, this one necessarily describes two concepts,
 * not one row. This is *not* the "multi-object package" the UX-14.5.10
 * discovery ruled out of scope (bundling several independently-exportable
 * objects, each with its own full identity/provenance/timestamps): each
 * endpoint here is a minimal descriptor — exactly the fields
 * `resolveCanonicalNode` needs to find-or-create it (`nodeType`, `title`,
 * `description`) — not a full `KnowledgeNodePackage`. If the importer
 * already has a matching concept (by title), the existing node is reused
 * untouched; only if it's genuinely new does a fresh one get created.
 *
 * Deliberately excludes `id`/`user_id`/`workspace_id`/`source_id`/
 * `target_id` (raw node ids — meaningless cross-account) and any
 * `created_at`/audit timestamp. `confidence` and `generatedBy` are
 * included whole — non-sensitive, descriptive provenance about how the
 * relationship was found, the same judgment Notes'/Knowledge Nodes'
 * `generationMetadata` already made.
 */
export interface KnowledgeLinkEndpointPayload {
  nodeType: KnowledgeNodeType
  title: string
  description: string | null
}

export interface KnowledgeLinkPackagePayload {
  relationshipType: string
  /** 0..1 from the original relationship detection, or null if it predates confidence scoring. Informational only. */
  confidence: number | null
  /** e.g. 'ai:detect-relationships' — which capability found this relationship. Null only for a hypothetical user-authored link; every relationship this app can currently produce sets it (see the implementation record for why: there is no manual node-to-node linking feature today). */
  generatedBy: string | null
  source: KnowledgeLinkEndpointPayload
  target: KnowledgeLinkEndpointPayload
}

export interface KnowledgeLinkPackage {
  version: number
  exportedAt: string
  sourceVersion: string
  link: KnowledgeLinkPackagePayload
}
