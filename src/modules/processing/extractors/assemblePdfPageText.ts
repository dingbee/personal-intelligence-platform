/**
 * I3 Document Intelligence — reconstructs line/paragraph structure from
 * pdf.js's flat per-page TextItem stream.
 *
 * `page.getTextContent()` returns items in content-stream order with two
 * signals this file is the only place that reads: `hasEOL` (this item is
 * followed by a line break) and `transform` (the item's position, whose
 * index-5 component is its baseline y). The previous extraction
 * (`pdf.ts`) discarded both and joined every item on a page with a single
 * space, collapsing every heading, paragraph, list item, and table row on
 * a page into one run-on string — confirmed against real production
 * documents (a table's header row and every data row joined into one
 * indistinguishable sentence, e.g. "Variable Characteristic Frequency
 * (N=86) Percentage Bone fractured Distal Femur 31 36.05%..."). That in
 * turn fed `paragraphChunker` a single page-sized "paragraph" with no
 * `\n{2,}` to split on, so a page over ~1200 chars got hard-split at an
 * arbitrary character offset (`splitLongText`), not at any real
 * paragraph/table/heading boundary.
 *
 * This mirrors `epub.ts`'s own `extractTextWithBreaks` — the same "insert
 * breaks so paragraph structure survives into plain text" principle EPUB
 * already applies by walking the DOM's block-tag boundaries — except a
 * PDF page has no DOM, so line/paragraph boundaries are reconstructed
 * from pdf.js's own per-item line-break flag and vertical position
 * instead. Not OCR, not a layout model, not a redesign of extraction:
 * exactly the same category of correction EPUB already established, one
 * format later.
 */
export interface PositionedTextItem {
  str: string
  hasEOL: boolean
  transform: number[]
}

/** A vertical gap between consecutive lines larger than this multiple of the page's own typical (median) line-to-line gap is treated as a paragraph break rather than an ordinary line wrap. */
const PARAGRAPH_GAP_MULTIPLIER = 1.5

interface Line {
  text: string
  y: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

/**
 * Groups a page's TextItems into lines at each `hasEOL` boundary. Items
 * within a line are still joined with a single space each, exactly as the
 * previous whole-page join already did — that part isn't a confirmed
 * defect (pdf.js frequently emits its own leading/trailing spaces inside
 * `str`, hence the doubled-space artifacts visible in real extracted
 * text) and is left unchanged; only the previously-nonexistent
 * *across-line* separator is what this function adds.
 */
function groupIntoLines(items: PositionedTextItem[]): Line[] {
  const lines: Line[] = []
  let buffer = ''
  let lineY: number | null = null

  for (const item of items) {
    if (lineY === null) lineY = item.transform[5] ?? 0
    buffer += buffer ? ` ${item.str}` : item.str
    if (item.hasEOL) {
      lines.push({ text: buffer, y: lineY })
      buffer = ''
      lineY = null
    }
  }
  if (buffer) lines.push({ text: buffer, y: lineY ?? 0 })

  return lines
}

/**
 * Reassembles one PDF page's TextItems into text with real line breaks
 * (`\n`) and paragraph breaks (`\n\n`, when a line-to-line vertical gap is
 * markedly larger than the page's own typical line spacing) — the exact
 * `\n{2,}` structure `paragraphChunker`/`chunkParagraphs` (chunking.ts)
 * already looks for. Never fabricates a break that isn't backed by the
 * PDF's own layout data; when there's only one line (or no `hasEOL`
 * signals at all — some PDFs never set it), returns that line unchanged,
 * identical to the previous behavior for that case.
 */
export function assemblePdfPageText(items: PositionedTextItem[]): string {
  const lines = groupIntoLines(items).filter((line) => line.text.trim())
  if (lines.length === 0) return ''
  if (lines.length === 1) return lines[0]!.text.trim()

  const gaps: number[] = []
  for (let i = 1; i < lines.length; i++) {
    const gap = Math.abs(lines[i - 1]!.y - lines[i]!.y)
    if (gap > 0) gaps.push(gap)
  }
  const typicalGap = median(gaps)

  let result = lines[0]!.text.trim()
  for (let i = 1; i < lines.length; i++) {
    const gap = Math.abs(lines[i - 1]!.y - lines[i]!.y)
    const isParagraphBreak = typicalGap > 0 && gap > typicalGap * PARAGRAPH_GAP_MULTIPLIER
    result += (isParagraphBreak ? '\n\n' : '\n') + lines[i]!.text.trim()
  }
  return result
}
