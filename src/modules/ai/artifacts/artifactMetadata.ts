import type { Note } from '@/shared/types/database'
import { type ArtifactKind, isArtifactKind } from '@/modules/ai/artifacts/artifactTypes'

/**
 * UX-14.4 Phase 1 — reads the `artifactKind` tag Save As / the note-creation
 * paths below now write into `generation_metadata`. Every pre-existing note
 * (and every future note whose creator doesn't set one) has no such field —
 * those read as `'note'`, the correct default rather than an error, since
 * "no kind recorded" and "kind is note" mean the same thing to a reader.
 */
export function getArtifactKind(note: Pick<Note, 'generation_metadata'>): ArtifactKind {
  const raw = (note.generation_metadata as Record<string, unknown> | null)?.artifactKind
  return isArtifactKind(raw) ? raw : 'note'
}

/** Merges an `artifactKind` tag into an existing (or absent) generation_metadata object, without disturbing whatever else a caller already put there. */
export function withArtifactKind(
  metadata: Record<string, unknown> | null | undefined,
  kind: ArtifactKind,
): Record<string, unknown> {
  return { ...(metadata ?? {}), artifactKind: kind }
}

/**
 * UX-14.4 Phase 2 — the structured-payload slot the discovery doc's §2
 * designed for `spreadsheet`/`formula` kinds. Deliberately generic (not
 * spreadsheet-typed) so a future `chart`/`template` payload reuses the same
 * `generation_metadata.artifactData` slot instead of inventing a second one.
 */
export function getArtifactData<T = unknown>(note: Pick<Note, 'generation_metadata'>): T | null {
  const raw = (note.generation_metadata as Record<string, unknown> | null)?.artifactData
  return raw === undefined ? null : (raw as T)
}

/** Merges an `artifactData` payload into an existing (or absent) generation_metadata object, alongside whatever `artifactKind`/other fields are already there. */
export function withArtifactData(
  metadata: Record<string, unknown> | null | undefined,
  data: unknown,
): Record<string, unknown> {
  return { ...(metadata ?? {}), artifactData: data }
}
