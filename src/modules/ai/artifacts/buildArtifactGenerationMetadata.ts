import type { ArtifactKind } from '@/modules/ai/artifacts/artifactTypes'
import { withArtifactData, withArtifactKind } from '@/modules/ai/artifacts/artifactMetadata'
import { parseMarkdownTableToArtifact } from '@/modules/ai/artifacts/spreadsheet/parseMarkdownTableToArtifact'

/**
 * UX-14.4 Phase 2 — the one place that decides which artifact kinds get a
 * structured `artifactData` payload alongside their `artifactKind` tag.
 * Today only `spreadsheet` does (Path A's deterministic markdown-table
 * parser); every other kind gets classification only, same as Phase 1
 * shipped. Shared by every note-creation call site so a future kind's
 * payload builder gets wired in exactly once, not once per caller.
 */
export function buildArtifactGenerationMetadata(
  content: string,
  kind: ArtifactKind,
  baseMetadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  let metadata = withArtifactKind(baseMetadata, kind)
  if (kind === 'spreadsheet') {
    const artifactData = parseMarkdownTableToArtifact(content)
    if (artifactData.sheets.length > 0) metadata = withArtifactData(metadata, artifactData)
  }
  return metadata
}
