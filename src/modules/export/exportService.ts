import { assertNoSensitiveContent, exportFilename, type ExportContent, type ExportFormat } from '@/modules/export/types'
import { exportContentToMarkdown } from '@/modules/export/exporters/markdownExporter'
import { exportContentToPdf } from '@/modules/export/exporters/pdfExporter'
import { exportContentToDocx } from '@/modules/export/exporters/docxExporter'

export interface GeneratedExport {
  filename: string
  blob: Blob
  mimeType: string
}

export interface ExportRequest {
  /** Normalized content for the three human-readable formats — never used for `'nova'` (see `buildNovaPackage` below). */
  content: ExportContent
  /** The object's own display title — used only to build a filesystem-safe filename, the same slugify convention every Knowledge Exchange package type's own filename helper already established. */
  titleForFilename: string
  /**
   * Produces the exact, unmodified NOVA package artifact this object type's
   * own existing Knowledge Exchange exporter already builds (e.g.
   * `exportNotePackage`/`exportKnowledgeNodePackage`/
   * `buildKnowledgeCollectionExportPackage`) — this service never
   * re-derives or duplicates that logic, only calls it. Returns a Promise
   * so both the synchronous (Note/Node) and asynchronous (Collection)
   * cases fit the same contract.
   */
  buildNovaPackage: () => Promise<{ filename: string; blob: Blob }>
}

/**
 * UX-14.5.11 — the one place the UI calls into to turn a Save As choice
 * into actual downloadable bytes. "UI only orchestrates" (the design
 * principle this phase specifies): `KnowledgeExportDialog` never touches
 * `jspdf`/`docx`/a Knowledge Exchange exporter directly, only this
 * function. `assertNoSensitiveContent` runs before any of the three
 * human-readable exporters touch `content` — the NOVA Package path
 * bypasses it because it never uses `content` at all, deferring entirely
 * to that object type's own, already-audited Knowledge Exchange exporter.
 */
export async function generateExport(format: ExportFormat, request: ExportRequest): Promise<GeneratedExport> {
  if (format === 'nova') {
    const { filename, blob } = await request.buildNovaPackage()
    return { filename, blob, mimeType: 'application/octet-stream' }
  }

  assertNoSensitiveContent(request.content)

  if (format === 'markdown') {
    const text = exportContentToMarkdown(request.content)
    return {
      filename: exportFilename(request.titleForFilename, 'md'),
      blob: new Blob([text], { type: 'text/markdown' }),
      mimeType: 'text/markdown',
    }
  }

  if (format === 'pdf') {
    const blob = await exportContentToPdf(request.content)
    return { filename: exportFilename(request.titleForFilename, 'pdf'), blob, mimeType: 'application/pdf' }
  }

  // format === 'docx'
  const blob = await exportContentToDocx(request.content)
  return {
    filename: exportFilename(request.titleForFilename, 'docx'),
    blob,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}
