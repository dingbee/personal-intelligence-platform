import type { InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'

const SIZE_BY_LEVEL: Record<number, string> = {
  1: 'text-xl font-semibold leading-snug',
  2: 'text-lg font-semibold leading-snug',
  3: 'text-base font-semibold leading-snug',
  4: 'text-sm font-semibold',
  5: 'text-sm font-medium',
  6: 'text-sm font-medium',
}

/** UX-13.6 Phase 1 — a heading gets extra top margin (beyond MarkdownRenderer's gap-3) so it visually separates from whatever preceded it; `first:mt-0` keeps a heading that opens the message flush with the top instead of floating. */
export function HeadingBlock({ level, inline }: { level: number; inline: InlineToken[] }) {
  const Tag = `h${Math.min(Math.max(level, 1), 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  return (
    <Tag className={`mt-1 first:mt-0 ${SIZE_BY_LEVEL[level] ?? SIZE_BY_LEVEL[6]} text-[var(--color-ink)]`}>
      {renderInlineTokens(inline)}
    </Tag>
  )
}
