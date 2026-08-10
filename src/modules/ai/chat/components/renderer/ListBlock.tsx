import type { ListItemNode } from '@/modules/ai/chat/components/renderer/parseMarkdownBlocks'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'

/** UX-13.6 Phase 1 — marker-color/spacing tuned to sit quietly next to prose: gap-1 (tighter than the paragraph rhythm, since list items read as one unit) and a muted marker so it doesn't compete with the item text. */
function ListBlockLevel({ ordered, items, nested }: { ordered: boolean; items: ListItemNode[]; nested: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag
      className={`flex flex-col gap-1 pl-5 marker:text-[var(--color-ink-muted)] ${ordered ? 'list-decimal' : 'list-disc'} ${nested ? 'mt-1' : ''}`}
    >
      {items.map((item, index) => (
        <li key={index} className="pl-0.5 leading-relaxed">
          {renderInlineTokens(item.inline)}
          {item.children && <ListBlockLevel ordered={item.children.ordered} items={item.children.items} nested />}
        </li>
      ))}
    </Tag>
  )
}

/**
 * Chat Outlining — renders a (possibly nested) list. Nesting depth is
 * expressed purely through nested <ol>/<ul> elements, each with its own
 * pl-5, so indentation compounds naturally the way real HTML list markup
 * always has — no depth-multiplied padding math needed.
 */
export function ListBlock({ ordered, items }: { ordered: boolean; items: ListItemNode[] }) {
  return <ListBlockLevel ordered={ordered} items={items} nested={false} />
}
