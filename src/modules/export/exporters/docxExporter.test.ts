import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { exportContentToDocx } from '@/modules/export/exporters/docxExporter'
import type { ExportContent } from '@/modules/export/types'

/** A real .docx is itself a zip archive — `word/document.xml` carries the actual text, so unzipping it (via the already-present `jszip` dependency) is a genuine content-correctness check, not just a "did it throw" smoke test. */
async function readDocumentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(blob)
  const entry = zip.file('word/document.xml')
  if (!entry) throw new Error('word/document.xml missing from generated .docx')
  return entry.async('text')
}

describe('exportContentToDocx', () => {
  it('produces a real zip archive containing word/document.xml', async () => {
    const blob = await exportContentToDocx({ title: 'Photosynthesis', sections: [] })
    const zip = await JSZip.loadAsync(blob)
    expect(zip.file('word/document.xml')).not.toBeNull()
  })

  it('embeds the title and subtitle text in the document XML', async () => {
    const blob = await exportContentToDocx({ title: 'Photosynthesis', subtitle: 'Concept · 82%', sections: [] })
    const xml = await readDocumentXml(blob)
    expect(xml).toContain('Photosynthesis')
    expect(xml).toContain('Concept')
  })

  it('embeds every section heading and body entry', async () => {
    const content: ExportContent = {
      title: 'Photosynthesis',
      sections: [
        { heading: 'Related Concepts', body: ['Chlorophyll (requires)'], format: 'list' },
        { heading: 'Evidence', body: ['Mentioned in Field Notes'], format: 'list' },
      ],
    }
    const blob = await exportContentToDocx(content)
    const xml = await readDocumentXml(blob)
    expect(xml).toContain('Related Concepts')
    expect(xml).toContain('Chlorophyll (requires)')
    expect(xml).toContain('Evidence')
    expect(xml).toContain('Mentioned in Field Notes')
  })

  it('handles a document with no sections at all', async () => {
    const blob = await exportContentToDocx({ title: 'Empty', sections: [] })
    const xml = await readDocumentXml(blob)
    expect(xml).toContain('Empty')
  })
})
