/** Client-side-only binary download — sibling to downloadTextFile.ts for non-text payloads (e.g. .xlsx) that need an ArrayBuffer and a MIME type instead of a plain string. */
export function downloadBinaryFile(filename: string, data: ArrayBuffer, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
