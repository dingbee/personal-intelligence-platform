import { KnowledgeCard } from '@/shared/components/knowledge/KnowledgeCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { MarkdownRenderer } from '@/modules/ai/chat/components/renderer/MarkdownRenderer'
import { ARTIFACT_KIND_DEFINITIONS } from '@/modules/ai/artifacts/artifactTypes'
import type { ArtifactPreview } from '@/modules/workspace-actions/types'

/**
 * UX-14.4.3 — presentation only: no artifact detection, no persistence.
 * Composes three already-existing primitives (`KnowledgeCard`, its
 * `confidence` slot which already renders `ConfidenceBadge`, and
 * `MarkdownRenderer`) rather than introducing a new artifact component
 * framework — exactly the "smallest architecture improvement" the
 * discovery identified. `typeLabel` reuses `ARTIFACT_KIND_DEFINITIONS`
 * directly rather than importing `ArtifactKindBadge`: that component
 * renders its own `StatusBadge`, and `KnowledgeCard` already renders one
 * for `typeLabel` — nesting both would double the badge, not reuse it.
 *
 * Confidence only renders when `preview.metadata.confidence` is a real
 * number — never fabricated. No current caller sets it (see
 * `generateSpreadsheetArtifactAction.ts`), so today every card renders
 * without one; the slot exists so a future caller with a real score
 * doesn't need this component to change.
 *
 * UX-14.4.4 — restores a signal this component's introduction silently
 * dropped: when `MessageBubble` renders this card, it renders it *instead
 * of* `message.content`, which is where the "This hasn't been saved yet —
 * say 'save this'..." framing actually lived. That sentence became
 * invisible for every generated artifact the moment this card started
 * rendering. The explicit "Preview — not saved" badge below is the fix —
 * a real UI signal instead of prose the card was silently swallowing.
 */
export function ArtifactPreviewCard({ preview }: { preview: ArtifactPreview }) {
  const confidence = typeof preview.metadata?.confidence === 'number' ? preview.metadata.confidence : undefined

  return (
    <KnowledgeCard title={preview.title} typeLabel={ARTIFACT_KIND_DEFINITIONS[preview.kind].label} confidence={confidence}>
      <div className="flex items-center gap-2">
        <StatusBadge label="Preview — not saved" variant="warning" />
        <span className="text-xs text-[var(--color-ink-muted)]">Say "save this" to keep it.</span>
      </div>
      {preview.summary && <p className="text-sm text-[var(--color-ink-muted)]">{preview.summary}</p>}
      {preview.content && <MarkdownRenderer content={preview.content} />}
    </KnowledgeCard>
  )
}
