/**
 * UX-14.5.9 — the one, versioned shape a Notes export/import package
 * takes. Allow-list, not deny-list (per `docs/ux-14.5.6-knowledge-
 * exchange-discovery.md` §5.3): only the fields listed here can ever
 * leave a note in a package, so a future note field nobody thought to
 * exclude defaults to *excluded*, not silently included.
 *
 * Deliberately excludes `id`, `user_id`, `workspace_id`, embeddings,
 * `ai_memory`, and provider configuration — none of those are fields on
 * this type at all, so there's no risk of a caller accidentally
 * forwarding them.
 *
 * `generationMetadata` carries this app's existing `artifactKind`/
 * `artifactData`/`creationMethod` convention already (see
 * `src/modules/ai/artifacts/artifactMetadata.ts`) — there is no separate
 * "artifact metadata" column in this schema to export as a distinct
 * field; it already lives inside `generation_metadata`, so exporting
 * that object whole satisfies both.
 */
export interface NotePackagePayload {
  title: string
  content: string
  /** Tag *names* only, never `tags.id` — re-resolved to the importing account's own tags on import (find-or-create by name), consistent with treating tags as a taxonomy convenience, not an identity-bearing object. */
  tags: string[]
  /** The original note's own timestamps, preserved as inert metadata only — never used to set the imported row's own `created_at`/`updated_at`, which reflect when *this account* actually received it. */
  createdAt: string
  updatedAt: string
  generationMetadata: Record<string, unknown> | null
}

export interface NotePackage {
  version: number
  exportedAt: string
  sourceVersion: string
  note: NotePackagePayload
}
