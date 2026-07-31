import { parseMarkdownBlocks, type MarkdownBlock } from '@/modules/ai/chat/components/renderer/parseMarkdownBlocks'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'
import { HeadingBlock } from '@/modules/ai/chat/components/renderer/HeadingBlock'
import { ListBlock } from '@/modules/ai/chat/components/renderer/ListBlock'
import { QuoteBlock } from '@/modules/ai/chat/components/renderer/QuoteBlock'
import { CodeBlock } from '@/modules/ai/chat/components/renderer/CodeBlock'
import { TableBlock } from '@/modules/ai/chat/components/renderer/TableBlock'

function renderBlock(block: MarkdownBlock, index: number) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock key={index} level={block.level} inline={block.inline} />
    case 'paragraph':
      return (
        <p key={index} className="whitespace-pre-wrap">
          {renderInlineTokens(block.inline)}
        </p>
      )
    case 'list':
      return <ListBlock key={index} ordered={block.ordered} items={block.items} />
    case 'quote':
      return <QuoteBlock key={index} inline={block.inline} />
    case 'code':
      return <CodeBlock key={index} language={block.language} content={block.content} />
    case 'table':
      return <TableBlock key={index} headers={block.headers} rows={block.rows} />
  }
}

/**
 * UX-13.5C — replaces MessageBubble's raw whitespace-pre-wrap text with
 * real rendering for headings/bold/italic/lists/tables/quotes/code/links,
 * per the phase brief. No dependency added: parseMarkdownBlocks/parseInline
 * are a small hand-written parser, and every token becomes a React element
 * (never dangerouslySetInnerHTML), so there's no HTML-injection surface —
 * the only place raw user/AI text reaches the DOM as an attribute is a
 * link's href, which parseInline's sanitizeHref already restricts to
 * http(s)/mailto/relative/hash schemes.
 *
 * Falls back to the exact plain-text rendering MessageBubble used before
 * this phase if parsing ever throws — "preserve plain text fallback" per
 * the brief, even though parseMarkdownBlocks is written to never throw on
 * its own.
 */
export function MarkdownRenderer({ content }: { content: string }) {
  try {
    const blocks = parseMarkdownBlocks(content)
    if (blocks.length === 0) return null
    // UX-13.6 Phase 1 — gap-3 (up from gap-2) for more breathing room between
    // blocks; HeadingBlock adds its own extra top margin on top of this for
    // a clearer size/weight hierarchy between a heading and what precedes it.
    return <div className="flex flex-col gap-3">{blocks.map(renderBlock)}</div>
  } catch {
    return <div className="whitespace-pre-wrap">{content}</div>
  }
}
