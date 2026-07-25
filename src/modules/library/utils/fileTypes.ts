import type { DocumentFileType } from '@/shared/types/database'

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024 // 200MB

const EXTENSION_TO_FILE_TYPE: Record<string, DocumentFileType> = {
  pdf: 'pdf',
  epub: 'epub',
  docx: 'docx',
  txt: 'txt',
  md: 'markdown',
  markdown: 'markdown',
}

const FILE_TYPE_LABEL: Record<DocumentFileType, string> = {
  pdf: 'PDF',
  epub: 'EPUB',
  docx: 'Word',
  txt: 'Text',
  markdown: 'Markdown',
}

const FILE_TYPE_ACCEPT = '.pdf,.epub,.docx,.txt,.md,.markdown'

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
