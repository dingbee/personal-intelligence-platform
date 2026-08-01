/** Client-side-only text download — no server call, no storage upload. Used by Export Knowledge Package. */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/markdown'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
