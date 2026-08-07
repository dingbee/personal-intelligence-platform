import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentMutations } from '@/modules/library/hooks/useDocumentMutations'
import { useAssets } from '@/modules/assets/hooks/useAssets'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { ACCEPTED_FILE_EXTENSIONS, MAX_UPLOAD_BYTES, formatFileSize, isSupportedFile } from '@/modules/library/utils/fileTypes'
import { SUPPORTED_IMAGE_MIME_TYPES, resolveFileSize, validateImageFile } from '@/modules/assets/validation'
import { Button } from '@/shared/components/ui/Button'

interface CaptureItem {
  id: string
  fileName: string
  kind: 'document' | 'image'
  status: 'uploading' | 'done' | 'error'
  resultId?: string
  error?: string
}

const URL_PATTERN = /^https?:\/\/\S+$/i

/**
 * UX-13 Knowledge Capture ("Universal Knowledge Inbox") — one global entry
 * point (Cmd/Ctrl+K → "Quick capture") that classifies whatever comes in
 * and routes it through the exact same pipelines the Library/Notes pages
 * already use: documents via useDocumentMutations (Library's Documents
 * tab), images via useAssets (Library's Images tab), typed text/pasted
 * links via useNotes (the Notes page). No new upload/validation/creation
 * logic — this is a routing layer over what already exists. A pasted URL
 * is saved as a note containing the link; fetching a title/preview for it
 * is a later roadmap item, not this one.
 */
export function QuickCaptureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload: uploadDocument } = useDocumentMutations()
  const { upload: uploadAsset } = useAssets()
  const { create: createNote } = useNotes()

  const [items, setItems] = useState<CaptureItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [text, setText] = useState('')
  const [savedNote, setSavedNote] = useState<{ id: string } | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Fresh form every time this is opened, same "reset on reopen" contract
  // as SaveConversationDialog/ConfirmDialog.
  useEffect(() => {
    if (!open) return
    setItems([])
    setText('')
    setSavedNote(null)
    setNoteError(null)
  }, [open])

  async function handleFiles(files: FileList | null) {
    if (!files) return

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID()

      if (isSupportedFile(file.name)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          setItems((prev) => [
            ...prev,
            { id, fileName: file.name, kind: 'document', status: 'error', error: `File exceeds ${formatFileSize(MAX_UPLOAD_BYTES)} limit` },
          ])
          continue
        }
        setItems((prev) => [...prev, { id, fileName: file.name, kind: 'document', status: 'uploading' }])
        try {
          const document = await uploadDocument.mutateAsync({ file, collectionId: null })
          setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'done', resultId: document.id } : item)))
        } catch (err) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : item,
            ),
          )
        }
        continue
      }

      const imageSize = await resolveFileSize(file)
      const imageValidation = validateImageFile({ type: file.type, size: imageSize })
      if (imageValidation.valid) {
        setItems((prev) => [...prev, { id, fileName: file.name, kind: 'image', status: 'uploading' }])
        try {
          const asset = await uploadAsset.mutateAsync({ file })
          setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'done', resultId: asset.id } : item)))
        } catch (err) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : item,
            ),
          )
        }
        continue
      }

      setItems((prev) => [...prev, { id, fileName: file.name, kind: 'document', status: 'error', error: 'Unsupported file type' }])
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    void handleFiles(event.dataTransfer.files)
  }

  async function saveNote() {
    const trimmed = text.trim()
    if (!trimmed) return
    setSavingNote(true)
    setNoteError(null)
    try {
      const title = (trimmed.split('\n')[0] ?? '').slice(0, 60) || 'Untitled note'
      const note = await createNote.mutateAsync({ title, content: trimmed })
      setSavedNote({ id: note.id })
      setText('')
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingNote(false)
    }
  }

  const isUrl = URL_PATTERN.test(text.trim())

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      aria-label="Quick capture"
      className="w-full max-w-lg rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] p-6 shadow-floating backdrop:bg-black/30"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Quick capture</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick capture"
            className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            Esc
          </button>
        </div>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Drop a file, or write something below — it goes to the right place automatically.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors ${
            dragOver ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'border-[var(--color-border)]'
          }`}
        >
          <p className="text-sm text-[var(--color-ink-muted)]">
            Drag a file here, or{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-[var(--color-accent)] hover:underline"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Documents (PDF, EPUB, DOCX, TXT, Markdown, Excel, CSV, ODS) or images (JPEG, PNG, WebP, GIF)
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={[ACCEPTED_FILE_EXTENSIONS, ...SUPPORTED_IMAGE_MIME_TYPES].join(',')}
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
                {item.status === 'done' && item.resultId ? (
                  <Link
                    to={item.kind === 'document' ? `/library/${item.resultId}` : `/library/assets/${item.resultId}`}
                    onClick={onClose}
                    className="shrink-0 text-[var(--color-accent)] hover:underline"
                  >
                    View →
                  </Link>
                ) : (
                  <span className={`shrink-0 ${item.status === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'}`}>
                    {item.status === 'uploading' && 'Uploading…'}
                    {item.status === 'error' && item.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-4">
          <label htmlFor="quick-capture-text" className="text-sm font-medium text-[var(--color-ink)]">
            Quick note or link
          </label>
          <textarea
            id="quick-capture-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Paste a link, or jot something down..."
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
          />
          {isUrl && <p className="text-xs text-[var(--color-ink-muted)]">Saved as a note containing this link.</p>}
          {noteError && <p className="text-sm text-[var(--color-danger)]">{noteError}</p>}
          {savedNote && (
            <p className="text-sm text-[var(--color-ink-muted)]">
              Saved —{' '}
              <Link to={`/notes/${savedNote.id}`} onClick={onClose} className="text-[var(--color-accent)] hover:underline">
                View note →
              </Link>
            </p>
          )}
          <Button loading={savingNote} disabled={!text.trim()} onClick={() => void saveNote()} className="self-end">
            Save note
          </Button>
        </div>

        <div className="flex justify-end border-t border-[var(--color-border)] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </dialog>
  )
}
