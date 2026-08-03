import { describe, expect, it, vi } from 'vitest'
import { generateExport } from '@/modules/export/exportService'
import type { ExportRequest } from '@/modules/export/exportService'
import type { ExportContent } from '@/modules/export/types'

function fakeRequest(overrides: Partial<ExportRequest> = {}): ExportRequest {
  const content: ExportContent = { title: 'Photosynthesis', subtitle: 'Concept', sections: [{ heading: 'Notes', body: ['plants make food'] }] }
  return {
    content,
    titleForFilename: 'Photosynthesis',
    buildNovaPackage: async () => ({ filename: 'photosynthesis.nova', blob: new Blob(['{"version":1}'], { type: 'application/json' }) }),
    ...overrides,
  }
}

describe('generateExport', () => {
  it('nova: calls buildNovaPackage and passes its filename/blob through untouched', async () => {
    const buildNovaPackage = vi.fn().mockResolvedValue({ filename: 'photosynthesis.nova', blob: new Blob(['payload']) })
    const result = await generateExport('nova', fakeRequest({ buildNovaPackage }))

    expect(buildNovaPackage).toHaveBeenCalledOnce()
    expect(result.filename).toBe('photosynthesis.nova')
    expect(await result.blob.text()).toBe('payload')
  })

  it('markdown: produces a .md file with the expected mime type', async () => {
    const result = await generateExport('markdown', fakeRequest())
    expect(result.filename).toBe('photosynthesis.md')
    expect(result.mimeType).toBe('text/markdown')
    expect(await result.blob.text()).toContain('# Photosynthesis')
  })

  it('pdf: produces a .pdf file', async () => {
    const result = await generateExport('pdf', fakeRequest())
    expect(result.filename).toBe('photosynthesis.pdf')
    expect(result.mimeType).toBe('application/pdf')
    expect(result.blob.size).toBeGreaterThan(0)
  })

  it('docx: produces a .docx file', async () => {
    const result = await generateExport('docx', fakeRequest())
    expect(result.filename).toBe('photosynthesis.docx')
    expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(result.blob.size).toBeGreaterThan(0)
  })

  it('never calls buildNovaPackage for a human-readable format', async () => {
    const buildNovaPackage = vi.fn()
    await generateExport('markdown', fakeRequest({ buildNovaPackage }))
    expect(buildNovaPackage).not.toHaveBeenCalled()
  })

  it('refuses to export markdown/pdf/docx when content contains a sensitive field reference', async () => {
    const tainted = fakeRequest({ content: { title: 'X', sections: [{ body: ['leaked user_id here'] }] } })
    await expect(generateExport('markdown', tainted)).rejects.toThrow(/refusing to export/i)
    await expect(generateExport('pdf', tainted)).rejects.toThrow(/refusing to export/i)
    await expect(generateExport('docx', tainted)).rejects.toThrow(/refusing to export/i)
  })

  it('the sensitive-content guard never blocks the nova path (it never touches content)', async () => {
    const buildNovaPackage = vi.fn().mockResolvedValue({ filename: 'x.nova', blob: new Blob(['ok']) })
    const tainted = fakeRequest({ content: { title: 'X', sections: [{ body: ['user_id'] }] }, buildNovaPackage })
    const result = await generateExport('nova', tainted)
    expect(result.filename).toBe('x.nova')
  })
})
