import type { DocumentFileType } from '@/shared/types/database'
import type { DocumentProcessor } from '@/modules/processing/extractors/types'
import { loadResilientChunk } from '@/shared/lib/resilientDynamicImport'

// Lazy-loaded per file type: pdfjs-dist, mammoth, and jszip are ~1MB
// combined and most sessions only ever touch one or two file types, so
// there's no reason to ship all of them in the main bundle.
const loaders: Record<DocumentFileType, () => Promise<DocumentProcessor>> = {
  pdf: () => import('@/modules/processing/extractors/pdf').then((m) => m.pdfProcessor),
  epub: () => import('@/modules/processing/extractors/epub').then((m) => m.epubProcessor),
  docx: () => import('@/modules/processing/extractors/docx').then((m) => m.docxProcessor),
  txt: () => import('@/modules/processing/extractors/txt').then((m) => m.txtProcessor),
  markdown: () => import('@/modules/processing/extractors/markdown').then((m) => m.markdownProcessor),
  xlsx: () => import('@/modules/processing/extractors/spreadsheet').then((m) => m.xlsxProcessor),
  csv: () => import('@/modules/processing/extractors/spreadsheet').then((m) => m.csvProcessor),
  ods: () => import('@/modules/processing/extractors/spreadsheet').then((m) => m.odsProcessor),
}

/**
 * Stale-chunk resilience — a tab left open across a deploy holds a module
 * graph pointing at the *previous* deployment's hashed chunk URLs, which
 * stop existing the moment the new deployment is promoted (Vercel serves
 * `/assets/*` as immutable per-deployment, with no cross-deployment
 * fallback). Processing is exactly where this bites hardest: it's often
 * the very first dynamic import a long-lived Library tab ever makes.
 * loadResilientChunk does a one-shot page reload on that specific failure
 * class and re-throws otherwise — this run still correctly ends up
 * 'failed' (Reprocess is what retries it, per the pipeline's existing
 * contract), but the *next* attempt runs against a freshly-synced bundle.
 */
export function getDocumentProcessor(fileType: DocumentFileType): Promise<DocumentProcessor> {
  return loadResilientChunk(loaders[fileType])
}
