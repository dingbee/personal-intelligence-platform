import type { DocumentFileType } from '@/shared/types/database'

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024 // 200MB

const EXTENSION_TO_FILE_TYPE: Record<string, DocumentFileType> = {
  pdf: 'pdf',
  epub: 'epub',
  docx: 'docx',
  txt: 'txt',
  md: 'markdown',
  markdown: 'markdown',
  xlsx: 'xlsx',
  csv: 'csv',
  ods: 'ods',
}

const FILE_TYPE_LABEL: Record<DocumentFileType, string> = {
  pdf: 'PDF',
  epub: 'EPUB',
  docx: 'Word',
  txt: 'Text',
  markdown: 'Markdown',
  xlsx: 'Excel',
  csv: 'CSV',
  ods: 'OpenDocument Sheet',
}

const FILE_TYPE_ACCEPT = '.pdf,.epub,.docx,.txt,.md,.markdown,.xlsx,.csv,.ods'

export function getExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? (parts.pop() ?? '').toLowerCase() : ''
}

export function fileTypeFromName(fileName: string): DocumentFileType | null {
  const ext = getExtension(fileName)
  return EXTENSION_TO_FILE_TYPE[ext] ?? null
}

export function fileTypeLabel(type: DocumentFileType): string {
  return FILE_TYPE_LABEL[type]
}

export function isSupportedFile(fileName: string): boolean {
  return fileTypeFromName(fileName) !== null
}

/**
 * UX-13.10.1 — Supabase Storage (S3-compatible) rejects or mishandles keys
 * containing characters like `[`, `]`, `{`, `}`, `#`, `%`, backtick, etc.
 * (surfaced as "Invalid key" on upload — e.g. "ARUSHA_SUPERMARKETS_LIST[1].xlsx").
 * Only the storage *path* needs this — `file_name`/`title` keep the exact
 * original filename, since those are just display strings, not object keys.
 */
export function sanitizeStorageFilename(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

export const ACCEPTED_FILE_EXTENSIONS = FILE_TYPE_ACCEPT
