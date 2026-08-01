import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { ARTIFACT_KIND_DEFINITIONS, type ArtifactKind } from '@/modules/ai/artifacts/artifactTypes'

/**
 * UX-14.4 Phase 1 — "let NOVA show what it created" instead of every note
 * looking identical regardless of source. Reuses the same `StatusBadge`
 * `KnowledgeCard` already renders its type pill with, so an artifact-kind
 * badge here and a node's type badge on the Knowledge Explorer read as the
 * same visual language. Renders nothing for the default 'note' kind — a
 * plain note looking like a plain note is the correct, unremarkable case.
 */
export function ArtifactKindBadge({ kind }: { kind: ArtifactKind }) {
  if (kind === 'note') return null
  return <StatusBadge label={ARTIFACT_KIND_DEFINITIONS[kind].label} variant="info" />
}
