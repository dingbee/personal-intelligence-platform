import type { ExportContent } from '@/modules/export/types'

const PAGE_MARGIN = 40

/**
 * `jspdf` is dynamically imported — the same lazy-loading discipline this
 * codebase already established for every other heavy, format-specific
 * dependency (`pdfjs-dist`/`mammoth`/`xlsx`, all resolved through
 * `processing/extractors/registry.ts`'s own `import()` map) — so a user
 * who never exports to PDF never pays for this library in their initial
 * bundle. Builds a plain, text-only document (no canvas/embedded fonts
 * beyond jsPDF's own built-in Helvetica metrics), which is all a Note/
 * Concept/Collection's normalized content ever needs.
 */
export async function exportContentToPdf(content: ExportContent): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt' })
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  const maxWidth = pageWidth - PAGE_MARGIN * 2

  let y = PAGE_MARGIN

  function ensureSpace(lineHeight: number) {
    if (y + lineHeight > pageHeight - PAGE_MARGIN) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }

  function writeText(text: string, size: number, style: 'normal' | 'bold' | 'italic', indent: number) {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    const lineHeight = size * 1.4
    const lines: string[] = doc.splitTextToSize(text, maxWidth - indent)
    for (const line of lines) {
      ensureSpace(lineHeight)
      doc.text(line, PAGE_MARGIN + indent, y)
      y += lineHeight
    }
  }

  writeText(content.title, 20, 'bold', 0)

  if (content.subtitle) {
    y += 4
    writeText(content.subtitle, 11, 'italic', 0)
  }

  for (const section of content.sections) {
    y += 14
    if (section.heading) {
      writeText(section.heading, 14, 'bold', 0)
      y += 4
    }
    for (const entry of section.body) {
      const isList = section.format === 'list'
      writeText(isList ? `• ${entry}` : entry, 11, 'normal', isList ? 14 : 0)
      y += 4
    }
  }

  return doc.output('blob')
}
