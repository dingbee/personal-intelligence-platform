import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentMutations } from '@/modules/library/hooks/useDocumentMutations'
import {
  ACCEPTED_FILE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  formatFileSize,
  isSupportedFile,
} from '@/modules/library/utils/fileTypes'
import { Button } from '@/shared/components/ui/Button'

interface UploadItem {
  id: string
  fileName: string
  status: 'uploading' | 'done' | 'error'
  error?: string
  isStorageQuotaError?: boolean
}

// Phase 5C Task 6 — the server-side storage-quota trigger
// (enforce_storage_quota(), 0046_feature_entitlements_and_storage_quota.sql)
// raises a plain Postgres exception on a blocked upload; before this
// phase that raw message was the only thing a Free user ever saw, with no
// path to an upgrade. This only changes what's DISPLAYED for that one
// known message shape — the trigger itself, the actual enforcement
// boundary, is untouched.
const STORAGE_QUOTA_ERROR_MARKER = 'Storage quota exceeded'

export function UploadDropzone({ collectionId }: { collectionId: string | null }) {
  const { upload } = useDocumentMutations()
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files) return

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID()

      if (!isSupportedFile(file.name)) {
        setItems((prev) => [
          ...prev,
          { id, fileName: file.name, status: 'error', error: 'Unsupported file type' },
        ])
        continue
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setItems((prev) => [
          ...prev,
          {
            id,
            fileName: file.name,
            status: 'error',
            error: `File exceeds ${formatFileSize(MAX_UPLOAD_BYTES)} limit`,
          },
        ])
        continue
      }

      setItems((prev) => [...prev, { id, fileName: file.name, status: 'uploading' }])
      try {
        await upload.mutateAsync({ file, collectionId })
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'done' } : item)))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        const isStorageQuotaError = message.includes(STORAGE_QUOTA_ERROR_MARKER)
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'error',
                  error: isStorageQuotaError ? "You've reached your storage limit." : message,
                  isStorageQuotaError,
                }
              : item,
          ),
        )
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    void handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragOver ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'border-[var(--color-border)]'
        }`}
      >
        <p className="text-sm text-[var(--color-ink-muted)]">
          Drag files here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-[var(--color-ink-muted)]">PDF, EPUB, DOCX, TXT, Markdown, Excel, CSV, ODS</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_EXTENSIONS}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <span className="truncate text-[var(--color-ink)]">{item.fileName}</span>
              <span className="flex items-center gap-2">
                <span
                  className={
                    item.status === 'error'
                      ? 'text-[var(--color-danger)]'
                      : item.status === 'done'
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-ink-muted)]'
                  }
                >
                  {item.status === 'uploading' && 'Uploading…'}
                  {item.status === 'done' && 'Uploaded'}
                  {item.status === 'error' && item.error}
                </span>
                {item.isStorageQuotaError && (
                  <Link to="/pricing" className="font-medium text-[var(--color-accent)] hover:underline">
                    Upgrade to Pro →
                  </Link>
                )}
              </span>
            </li>
          ))}
          <Button variant="ghost" onClick={() => setItems([])} className="self-end">
            Clear
          </Button>
        </ul>
      )}
    </div>
  )
}
