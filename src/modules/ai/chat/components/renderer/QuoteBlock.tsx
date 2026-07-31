import type { InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'

export function QuoteBlock({ inline }: { inline: InlineToken[] }) {
  return (
    <blockquote className="border-l-2 border-[var(--color-border)] pl-3 italic text-[var(--color-ink-muted)]">
      {renderInlineTokens(inline)}
    </blockquote>
  )
}
