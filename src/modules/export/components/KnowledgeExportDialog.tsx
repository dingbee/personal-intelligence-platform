import { useEffect, useState } from 'react'
import { EXPORT_FORMAT_OPTIONS } from '@/modules/export/types'
import type { ExportFormat } from '@/modules/export/types'
import type { ExportRequest } from '@/modules/export/exportService'
import { useExportDownload } from '@/modules/export/hooks/useExportDownload'
import { Button } from '@/shared/components/ui/Button'
import { Dialog } from '@/shared/components/ui/Dialog'

export interface KnowledgeExportDialogProps {
  open: boolean
  onClose: () => void
  /** e.g. "note", "concept", "collection" — used only for the dialog's own copy ("Download {objectLabel}"). */
  objectLabel: string
  /** Rebuilt on every render — cheap, since both `content` and `buildNovaPackage` close over data the parent page already has loaded. */
  request: ExportRequest
}

/**
 * UX-14.5.11 — the one reusable Save As / Download experience every
 * object type's own detail page opens, replacing the three previously
 * isolated "Export" buttons (Notes/Knowledge Nodes/Knowledge
 * Collections). Same native `<dialog>` shell (`showModal()`/`close()`,
 * reset-on-reopen) every Knowledge Exchange Import dialog already
 * established, adapted for a single-step "pick a format, download"
 * flow rather than a multi-step import — there is no created object to
 * link to afterward, so a successful download simply closes the dialog,
 * the same way a native OS "Save As" dialog closes once the file is saved.
 */
export function KnowledgeExportDialog({ open, onClose, objectLabel, request }: KnowledgeExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('nova')
  const download = useExportDownload()

  useEffect(() => {
    if (!open) return
    setFormat('nova')
    download.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Download {objectLabel}</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">Choose how you'd like to save this {objectLabel}.</p>

        <div role="radiogroup" aria-label="Export format" className="flex flex-col gap-2">
          {EXPORT_FORMAT_OPTIONS.map((option) => (
            <label
              key={option.format}
              className="flex cursor-pointer items-start gap-2.5 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 has-[:checked]:border-[var(--color-accent)]"
            >
              <input
                type="radio"
                name="export-format"
                className="mt-1"
                checked={format === option.format}
                onChange={() => setFormat(option.format)}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-[var(--color-ink)]">{option.label}</span>
                <span className="text-xs text-[var(--color-ink-muted)]">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        {download.isError && (
          <p className="text-sm text-[var(--color-danger)]">
            {download.error instanceof Error ? download.error.message : 'Failed to generate this export.'}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={download.isPending} onClick={() => download.mutate({ format, request }, { onSuccess: onClose })}>
            Download
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
