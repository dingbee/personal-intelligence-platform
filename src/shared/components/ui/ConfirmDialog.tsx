import { useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui/Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      onClose={onCancel}
      className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 backdrop:bg-black/30"
    >
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
      {description && <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{description}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          className={destructive ? 'bg-red-600 hover:bg-red-700' : undefined}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
