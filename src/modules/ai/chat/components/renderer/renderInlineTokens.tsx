import type { ReactNode } from 'react'
import type { InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'

/** UX-13.5C — shared by every block component (heading/paragraph/list/quote/table cell) so bold/italic/code/link rendering is defined exactly once. */
export function renderInlineTokens(tokens: InlineToken[]): ReactNode {
  return tokens.map((token, index) => {
    switch (token.type) {
      case 'bold':
        return <strong key={index}>{token.content}</strong>
      case 'italic':
        return <em key={index}>{token.content}</em>
      case 'code':
        return (
          <code key={index} className="rounded bg-[var(--surface-inset)] px-1 py-0.5 font-mono text-[0.85em]">
            {token.content}
          </code>
        )
      case 'link':
        return (
          <a
            key={index}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] underline underline-offset-2"
          >
            {token.content}
          </a>
        )
      case 'text':
      default:
        return <span key={index}>{token.content}</span>
    }
  })
}
