import type { InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'

/** UX-13.6 Phase 1 — marker-color/spacing tuned to sit quietly next to prose: gap-1 (tighter than the paragraph rhythm, since list items read as one unit) and a muted marker so it doesn't compete with the item text. */
export function ListBlock({ ordered, items }: { ordered: boolean; items: InlineToken[][] }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag
      className={`flex flex-col gap-1 pl-5 marker:text-[var(--color-ink-muted)] ${ordered ? 'list-decimal' : 'list-disc'}`}
    >
      {items.map((item, index) => (
        <li key={index} className="pl-0.5 leading-relaxed">
          {renderInlineTokens(item)}
        </li>
      ))}
    </Tag>
  )
}
