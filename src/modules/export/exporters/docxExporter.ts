import type { ExportContent } from '@/modules/export/types'

/**
 * `docx` is dynamically imported — same lazy-loading discipline as
 * `pdfExporter.ts`, so this library only loads for the user who actually
 * picks "Word." Uses the package's own native heading/bullet primitives
 * (`HeadingLevel`, `Paragraph`'s `bullet` option) rather than hand-rolled
 * text prefixes, since unlike a plain-text PDF/markdown render, a real
 * `.docx` consumer (Word, Google Docs) benefits from genuine structural
 * markup here.
 */
export async function exportContentToDocx(content: ExportContent): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel } = await import('docx')

  const children = [
    new Paragraph({ text: content.title, heading: HeadingLevel.TITLE }),
    ...(content.subtitle ? [new Paragraph({ text: content.subtitle, run: { italics: true } })] : []),
  ]

  for (const section of content.sections) {
    if (section.heading) {
      children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2 }))
    }
    for (const entry of section.body) {
      children.push(
        section.format === 'list' ? new Paragraph({ text: entry, bullet: { level: 0 } }) : new Paragraph({ text: entry }),
      )
    }
  }

  const document = new Document({ sections: [{ children }] })
  return Packer.toBlob(document)
}
