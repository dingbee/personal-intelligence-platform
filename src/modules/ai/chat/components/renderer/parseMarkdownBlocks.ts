import { parseInline, type InlineToken } from '@/modules/ai/chat/components/renderer/parseInline'

export interface ListItemNode {
  inline: InlineToken[]
  /** A sub-list nested one indentation level deeper under this item, or null for a leaf item. */
  children: MarkdownListNode | null
}

export interface MarkdownListNode {
  ordered: boolean
  items: ListItemNode[]
}

export type MarkdownBlock =
  | { type: 'heading'; level: number; inline: InlineToken[] }
  | { type: 'paragraph'; inline: InlineToken[] }
  | ({ type: 'list' } & MarkdownListNode)
  | { type: 'quote'; inline: InlineToken[] }
  | { type: 'code'; language: string | null; content: string }
  | { type: 'table'; headers: InlineToken[][]; rows: InlineToken[][][] }

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+\.)\s+(.*)$/
const QUOTE_RE = /^\s*>\s?(.*)$/
const FENCE_RE = /^```(\w*)\s*$/
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

interface RawListLine {
  indent: number
  ordered: boolean
  content: string
}

function matchListLine(line: string): RawListLine | null {
  const match = line.match(LIST_ITEM_RE)
  if (!match) return null
  return { indent: match[1]!.length, ordered: /^\d+\.$/.test(match[2]!), content: match[3]! }
}

/**
 * Consumes a contiguous run of list-item lines starting at `startIndex`,
 * recursing into deeper-indented runs as the previous item's nested
 * sub-list. A shallower indent, or a marker-type change (ordered <->
 * unordered) at the same depth, ends the current list and returns control
 * to the caller — so "1. ...\n   - ..." resolves to a parent item with a
 * nested child list, while "- ...\n1. ..." (same depth, different marker)
 * resolves to two separate sibling list blocks.
 */
function parseListRun(lines: string[], startIndex: number): { node: MarkdownListNode; nextIndex: number } {
  const first = matchListLine(lines[startIndex]!)!
  const indent = first.indent
  const ordered = first.ordered
  const items: ListItemNode[] = []
  let i = startIndex

  while (i < lines.length) {
    const raw = matchListLine(lines[i]!)
    if (!raw || raw.indent < indent || (raw.indent === indent && raw.ordered !== ordered)) break

    if (raw.indent > indent) {
      if (items.length === 0) break // deeper indent with no parent item yet — malformed, stop rather than misattribute
      const nested = parseListRun(lines, i)
      items[items.length - 1]!.children = nested.node
      i = nested.nextIndex
      continue
    }

    items.push({ inline: parseInline(raw.content), children: null })
    i++
  }

  return { node: { ordered, items }, nextIndex: i }
}

/**
 * UX-13.5C — a minimal, line-based block splitter: headings, paragraphs,
 * ordered/unordered (and nested) lists, blockquotes, fenced code blocks,
 * and GFM-style pipe tables. Not a CommonMark implementation (no lazy-
 * continuation edge cases) — just the block types the phase brief asks
 * for, plus indentation-aware list nesting. Every branch consumes at
 * least one line per iteration, so this always terminates even on
 * malformed input; MarkdownRenderer wraps the call in a try/catch anyway
 * as the "preserve plain text fallback" safety net the brief requires.
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

    if (matchListLine(line)) {
      const { node, nextIndex } = parseListRun(lines, i)
      blocks.push({ type: 'list', ordered: node.ordered, items: node.items })
      i = nextIndex
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
      !matchListLine(lines[i]!) &&
      !FENCE_RE.test(lines[i]!)
    ) {
      paragraphLines.push(lines[i]!)
      i++
    }
    blocks.push({ type: 'paragraph', inline: parseInline(paragraphLines.join('\n')) })
  }

  return blocks
}
