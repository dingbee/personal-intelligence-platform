import { describe, expect, it } from 'vitest'
import { assemblePdfPageText, type PositionedTextItem } from '@/modules/processing/extractors/assemblePdfPageText'

/** Builds a PositionedTextItem the way pdf.js actually would: `transform[5]` is the line's baseline y (page-top-down in these fixtures, larger y = higher on the page, matching PDF user space), `hasEOL` marks the last item on a visual line. */
function item(str: string, y: number, hasEOL = false): PositionedTextItem {
  return { str, hasEOL, transform: [1, 0, 0, 1, 0, y] }
}

describe('assemblePdfPageText', () => {
  it('returns empty string for a page with no text items', () => {
    expect(assemblePdfPageText([])).toBe('')
  })

  it('returns a single line unchanged when there is only one line on the page', () => {
    expect(assemblePdfPageText([item('a', 700), item('lone', 700), item('title', 700, true)])).toBe('a lone title')
  })

  it('joins items on the same line with a single space, unchanged from the previous whole-page-join behavior', () => {
    const items = [item('Var', 700), item('iable', 700, true)]
    expect(assemblePdfPageText(items)).toBe('Var iable')
  })

  it('separates consecutive lines at normal line spacing with a single newline, not a space', () => {
    // Regular body-text line spacing (~14pt gaps), no paragraph-sized jump.
    const items = [
      item('First line of a paragraph.', 700, true),
      item('Second line, same paragraph.', 686, true),
      item('Third line, same paragraph.', 672, true),
    ]
    const result = assemblePdfPageText(items)
    expect(result).toBe('First line of a paragraph.\nSecond line, same paragraph.\nThird line, same paragraph.')
    expect(result).not.toContain('  ')
  })

  it('inserts a paragraph break (\\n\\n) at a vertical gap markedly larger than the page\'s typical line spacing', () => {
    const items = [
      item('First paragraph, line one.', 700, true),
      item('First paragraph, line two.', 686, true),
      // A much bigger gap than the ~14pt body-text spacing above signals a new paragraph.
      item('Second paragraph starts here.', 656, true),
      item('Second paragraph, line two.', 642, true),
    ]
    const result = assemblePdfPageText(items)
    expect(result).toBe('First paragraph, line one.\nFirst paragraph, line two.\n\nSecond paragraph starts here.\nSecond paragraph, line two.')
  })

  it('handles a trailing line with no hasEOL (the last line of a page is not always flagged)', () => {
    const items = [item('First line.', 700, true), item('Last line, never flagged.', 686)]
    expect(assemblePdfPageText(items)).toBe('First line.\nLast line, never flagged.')
  })

  it('skips blank lines (empty or whitespace-only) without producing empty output lines', () => {
    const items = [item('First line.', 700, true), item('  ', 686, true), item('Third line.', 672, true)]
    expect(assemblePdfPageText(items)).toBe('First line.\nThird line.')
  })

  it('real-data regression: a title-page block reconstructs as distinct lines instead of one run-on string', () => {
    // Modeled directly on a real production PDF's actual (broken) chunk content before this fix:
    // "OUTCOMES OF EARLY PHYSIOTHERAPY ... BY DR. ABRAHAM ... A DISSERTATION SUBMITTED ... ©2026"
    // was one single 491-character paragraph with zero breaks between the title, author, and
    // degree-statement blocks — three genuinely distinct lines on the source page.
    const items = [
      item('OUTCOMES OF EARLY PHYSIOTHERAPY ON SHORT-TERM KNEE FUNCTION', 700, true),
      item('BY DR. ABRAHAM CHRISTOPHER NGONYA', 640, true),
      item('A DISSERTATION SUBMITTED IN PARTIAL FULFILLMENT', 600, true),
    ]
    const result = assemblePdfPageText(items)
    const lines = result.split(/\n+/)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('OUTCOMES OF EARLY PHYSIOTHERAPY ON SHORT-TERM KNEE FUNCTION')
    expect(lines[1]).toBe('BY DR. ABRAHAM CHRISTOPHER NGONYA')
    expect(lines[2]).toBe('A DISSERTATION SUBMITTED IN PARTIAL FULFILLMENT')
  })

  it('real-data regression: a data table reconstructs as one line per row instead of one run-on sentence', () => {
    // Modeled on the same real document's actual Table 1 — previously extracted as one
    // indistinguishable string: "Variable Characteristic Frequency (N=86) Percentage Bone
    // fractured Distal Femur 31 36.05% Proximal Tibia 55 63.95%..." with no way to tell which
    // number belonged to which row. Each table row is its own line in the source PDF (its own
    // hasEOL-terminated content-stream line), so line reconstruction alone recovers row identity
    // even without full cell/column markup.
    const items = [
      item('Table 1: Fracture Pattern for Distal Femur and Tibia plateau fractures', 700, true),
      item('Variable', 680),
      item('Characteristic', 680),
      item('Frequency (N=86)', 680),
      item('Percentage', 680, true),
      item('Bone fractured', 664),
      item('Distal Femur', 664),
      item('31', 664),
      item('36.05%', 664, true),
      item('Proximal Tibia', 648),
      item('55', 648),
      item('63.95%', 648, true),
    ]
    const result = assemblePdfPageText(items)
    const lines = result.split('\n').filter(Boolean)
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe('Variable Characteristic Frequency (N=86) Percentage')
    expect(lines[2]).toBe('Bone fractured Distal Femur 31 36.05%')
    expect(lines[3]).toBe('Proximal Tibia 55 63.95%')
    // Every row is now independently locatable, unlike the previous single-string join.
    expect(result).not.toBe(lines.join(' '))
  })

  it('never fabricates a paragraph break when line spacing is perfectly uniform throughout the page', () => {
    const items = Array.from({ length: 6 }, (_, i) => item(`Line ${i}.`, 700 - i * 14, true))
    const result = assemblePdfPageText(items)
    expect(result).not.toContain('\n\n')
    expect(result.split('\n')).toHaveLength(6)
  })
})
