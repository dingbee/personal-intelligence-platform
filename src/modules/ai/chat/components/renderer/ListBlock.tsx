import type { InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'

export function ListBlock({ ordered, items }: { ordered: boolean; items: InlineToken[][] }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`flex flex-col gap-0.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
      {items.map((item, index) => (
        <li key={index}>{renderInlineTokens(item)}</li>
      ))}
    </Tag>
  )
}
