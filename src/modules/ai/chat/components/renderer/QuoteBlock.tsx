import type { InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'

/** UX-13.6 Phase 1 — a subtle tinted panel (not just an italic left-border rule) so a quoted passage reads as a distinct block rather than de-emphasized text. */
export function QuoteBlock({ inline }: { inline: InlineToken[] }) {
  return (
    <blockquote className="rounded-r-control border-l-2 border-[var(--color-accent)]/40 bg-[var(--surface-inset)] py-1.5 pl-3 pr-2 italic leading-relaxed text-[var(--color-ink-muted)]">
      {renderInlineTokens(inline)}
    </blockquote>
  )
}
