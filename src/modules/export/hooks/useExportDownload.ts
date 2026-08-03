import { useMutation } from '@tanstack/react-query'
import { generateExport } from '@/modules/export/exportService'
import type { ExportFormat } from '@/modules/export/types'
import type { ExportRequest } from '@/modules/export/exportService'
import { downloadBinaryFile } from '@/shared/utils/downloadBinaryFile'

/**
 * UI only orchestrates: this hook calls `generateExport` (the one place
 * format-specific generation logic lives) then triggers the browser
 * download via the existing, unmodified `downloadBinaryFile` util — no
 * new download-trigger code, reusing the same anchor-click pattern every
 * other Export button in this app already uses.
 */
export function useExportDownload() {
  return useMutation({
    mutationFn: async (params: { format: ExportFormat; request: ExportRequest }) => generateExport(params.format, params.request),
    onSuccess: async ({ filename, blob, mimeType }) => {
      downloadBinaryFile(filename, await blob.arrayBuffer(), mimeType)
    },
  })
}
