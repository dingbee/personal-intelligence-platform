/**
 * UX-14.5.10.1 — the one, versioned shape a Knowledge Node export/import
 * package takes, following `notes/notePackageTypes.ts`'s exact pattern.
 * Allow-list, not deny-list (per `docs/ux-14.5.10-knowledge-exchange-
 * expansion-discovery.md` §4/§6): only the fields listed here can ever
 * leave a node in a package. No `id`, `user_id`, `workspace_id`,
 * embeddings, `ai_memory`, or provider config are fields on this type at
 * all, so there's no risk of a caller accidentally forwarding them.
 *
 * `source_chunk_ids` is deliberately excluded — it references chunks
 * that only exist in the exporting account, meaningless cross-account,
 * same reasoning `notePackageTypes.ts` already documents for Notes.
 * `metadata` (the node's own small descriptive JSONB, e.g.
 * `{entityType: 'person'}`) and `generation_metadata` (extraction
 * provenance, e.g. `{capability, model, generated_at}`) are both plain,
 * non-sensitive descriptive data — safe to export whole, same as Notes'
 * `generationMetadata`.
 *
 * `knowledge_links` (relationships to other nodes) are explicitly
 * **excluded from this phase** — a link is only meaningful between two
 * endpoints that are *both* present in the same package
 * (`docs/ux-14.5.10-knowledge-exchange-expansion-discovery.md` §2.4/§3),
 * which requires a multi-object package this task's own scope
 * ("Do not build ... multi-object packages") rules out. A Knowledge
 * Node package this phase is deliberately single-node, exactly like
 * UX-14.5.9's Notes package was deliberately single-note.
 */
export interface KnowledgeNodePackagePayload {
  nodeType: 'concept' | 'entity'
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  generationMetadata: Record<string, unknown> | null
  /** The original node's own timestamps, preserved as inert metadata only — never used to set the imported row's own `created_at`/`updated_at`. */
  createdAt: string
  updatedAt: string
}

export interface KnowledgeNodePackage {
  version: number
  exportedAt: string
  sourceVersion: string
  node: KnowledgeNodePackagePayload
}
