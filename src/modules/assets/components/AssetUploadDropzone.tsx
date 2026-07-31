import { useRef, useState, type DragEvent } from 'react'
import { useAssets } from '@/modules/assets/hooks/useAssets'
import { SUPPORTED_IMAGE_MIME_TYPES, resolveFileSize, validateImageFile } from '@/modules/assets/validation'
import { Button } from '@/shared/components/ui/Button'

interface UploadItem {
  id: string
  fileName: string
  status: 'uploading' | 'done' | 'error'
  error?: string
}

/** UX-13.9 — the image equivalent of UploadDropzone, same drag/drop + progress-list shape, validated through validateImageFile (mime + size) instead of isSupportedFile. */
export function AssetUploadDropzone() {
  const { upload } = useAssets()
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files) return

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID()
      const size = await resolveFileSize(file)
      const validation = validateImageFile({ type: file.type, size })

      if (!validation.valid) {
        setItems((prev) => [...prev, { id, fileName: file.name, status: 'error', error: validation.error ?? 'Invalid image' }])
        continue
      }

      setItems((prev) => [...prev, { id, fileName: file.name, status: 'uploading' }])
      try {
        await upload.mutateAsync({ file })
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'done' } : item)))
      } catch (err) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : item,
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
          Drag images here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-[var(--color-ink-muted)]">JPEG, PNG, WebP, GIF</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SUPPORTED_IMAGE_MIME_TYPES.join(',')}
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
            <li key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
              <span className="truncate text-[var(--color-ink)]">{item.fileName}</span>
              <span
                className={
                  item.status === 'error' ? 'text-red-600' : item.status === 'done' ? 'text-green-600' : 'text-[var(--color-ink-muted)]'
                }
              >
                {item.status === 'uploading' && 'Uploading…'}
                {item.status === 'done' && 'Uploaded'}
                {item.status === 'error' && item.error}
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
