import type { InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'
import { renderInlineTokens } from '@/modules/ai/chat/components/renderer/renderInlineTokens'

export function TableBlock({ headers, rows }: { headers: InlineToken[][]; rows: InlineToken[][][] }) {
  return (
    <div className="overflow-x-auto rounded-control border border-[var(--color-border)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--surface-inset)]">
          <tr>
            {headers.map((cell, index) => (
              <th key={index} className="border-b border-[var(--color-border)] px-2 py-1.5 font-medium text-[var(--color-ink)]">
                {renderInlineTokens(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[var(--color-border)] last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-1.5 text-[var(--color-ink)]">
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
