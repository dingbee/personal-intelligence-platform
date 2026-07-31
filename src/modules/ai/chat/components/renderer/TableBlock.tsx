import type { InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'

/** UX-13.6 Phase 1 — zebra striping (odd rows tinted) replaces relying on borders alone to separate rows, and a hover tint gives the table a sense of being a real, scannable grid rather than plain marked-up text. */
export function TableBlock({ headers, rows }: { headers: InlineToken[][]; rows: InlineToken[][][] }) {
  return (
    <div className="overflow-x-auto rounded-control border border-[var(--color-border)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--surface-raised)]">
          <tr>
            {headers.map((cell, index) => (
              <th key={index} className="border-b border-[var(--color-border)] px-3 py-2 font-medium text-[var(--color-ink)]">
                {renderInlineTokens(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--surface-inset)] ${
                rowIndex % 2 === 1 ? 'bg-[var(--surface-inset)]/40' : ''
              }`}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 text-[var(--color-ink)]">
                  {renderInlineTokens(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
