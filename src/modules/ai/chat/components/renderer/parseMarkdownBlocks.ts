import { parseInline, type InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'

export type MarkdownBlock =
  | { type: 'heading'; level: number; inline: InlineToken[] }
  | { type: 'paragraph'; inline: InlineToken[] }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] }
  | { type: 'quote'; inline: InlineToken[] }
  | { type: 'code'; language: string | null; content: string }
  | { type: 'table'; headers: InlineToken[][]; rows: InlineToken[][][] }

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const UNORDERED_RE = /^\s*[-*+]\s+(.*)$/
const ORDERED_RE = /^\s*\d+\.\s+(.*)$/
const QUOTE_RE = /^\s*>\s?(.*)$/
const FENCE_RE = /^```(\w*)\s*$/
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

/**
 * UX-13.5C — a minimal, line-based block splitter: headings, paragraphs,
 * ordered/unordered lists, blockquotes, fenced code blocks, and GFM-style
 * pipe tables. Not a CommonMark implementation (no nested blocks, no
 * lazy-continuation edge cases) — just the block types the phase brief
 * asks for. Every branch consumes at least one line per iteration, so
 * this always terminates even on malformed input; MarkdownRenderer wraps
 * the call in a try/catch anyway as the "preserve plain text fallback"
 * safety net the brief requires.
 */
export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split('\n')
  const blocks: MarkdownBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    if (line.trim() === '') {
      i++
      continue
    }

    const fenceMatch = line.match(FENCE_RE)
    if (fenceMatch) {
      const language = fenceMatch[1] || null
      const codeLines: string[] = []
      i++
      while (i < lines.length && !FENCE_RE.test(lines[i]!)) {
        codeLines.push(lines[i]!)
        i++
      }
      i++ // skip the closing fence, if present — if the AI never closed it, this just reaches the end
      blocks.push({ type: 'code', language, content: codeLines.join('\n') })
      continue
    }

    const headingMatch = line.match(HEADING_RE)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1]!.length, inline: parseInline(headingMatch[2]!) })
      i++
      continue
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && QUOTE_RE.test(lines[i]!)) {
        quoteLines.push(lines[i]!.replace(QUOTE_RE, '$1'))
        i++
      }
      blocks.push({ type: 'quote', inline: parseInline(quoteLines.join(' ')) })
      continue
    }

    if (UNORDERED_RE.test(line) || ORDERED_RE.test(line)) {
      const ordered = ORDERED_RE.test(line)
      const pattern = ordered ? ORDERED_RE : UNORDERED_RE
      const items: InlineToken[][] = []
      while (i < lines.length && pattern.test(lines[i]!)) {
        const itemMatch = lines[i]!.match(pattern)!
        items.push(parseInline(itemMatch[1]!))
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[i + 1]!)) {
      const headers = splitTableRow(line).map((cell) => parseInline(cell))
      i += 2
      const rows: InlineToken[][][] = []
      while (i < lines.length && lines[i]!.includes('|') && lines[i]!.trim() !== '') {
        rows.push(splitTableRow(lines[i]!).map((cell) => parseInline(cell)))
        i++
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    const paragraphLines: string[] = []
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !HEADING_RE.test(lines[i]!) &&
      !QUOTE_RE.test(lines[i]!) &&
      !UNORDERED_RE.test(lines[i]!) &&
      !ORDERED_RE.test(lines[i]!) &&
      !FENCE_RE.test(lines[i]!)
    ) {
      paragraphLines.push(lines[i]!)
      i++
    }
    blocks.push({ type: 'paragraph', inline: parseInline(paragraphLines.join('\n')) })
  }

  return blocks
}
