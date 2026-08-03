import { describe, expect, it } from 'vitest'
import { exportContentToPdf } from '@/modules/export/exporters/pdfExporter'
import type { ExportContent } from '@/modules/export/types'

describe('exportContentToPdf', () => {
  it('produces a structurally valid PDF blob (starts with the %PDF- magic header)', async () => {
    const blob = await exportContentToPdf({ title: 'Photosynthesis', subtitle: 'Concept', sections: [{ heading: 'Notes', body: ['plants make food'] }] })

    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(0)
    const header = new TextDecoder('latin1').decode((await blob.arrayBuffer()).slice(0, 5))
    expect(header).toBe('%PDF-')
  })

  it('handles a document with no sections at all', async () => {
    const blob = await exportContentToPdf({ title: 'Empty', sections: [] })
    expect(blob.size).toBeGreaterThan(0)
  })

  it('paginates long content without throwing', async () => {
    const content: ExportContent = {
      title: 'Long Document',
      sections: [{ heading: 'Evidence', body: Array.from({ length: 200 }, (_, i) => `Item number ${i} with some descriptive text to wrap.`), format: 'list' }],
    }
    const blob = await exportContentToPdf(content)
    expect(blob.size).toBeGreaterThan(0)
  })
})
