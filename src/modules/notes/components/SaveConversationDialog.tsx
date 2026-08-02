import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  collectSourceChunkIds,
  filterMessagesForScope,
  formatConversationAsNoteContent,
  type ConversationNoteMessage,
  type ConversationSaveScope,
} from '@/modules/notes/conversationToNote'
import { createNote } from '@/modules/notes/api/notes'
import { addTagToNote } from '@/modules/notes/api/noteTags'
import { linkNoteToConversation } from '@/modules/notes/api/knowledgeLinks'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { detectArtifactKind } from '@/modules/ai/artifacts/detectArtifactKind'
import { buildArtifactGenerationMetadata } from '@/modules/ai/artifacts/buildArtifactGenerationMetadata'
import { withCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'
import { ARTIFACT_KIND_DEFINITIONS, ARTIFACT_KIND_ORDER, type ArtifactKind } from '@/modules/ai/artifacts/artifactTypes'

const SCOPE_OPTIONS: { value: ConversationSaveScope; label: string }[] = [
  { value: 'entire', label: 'Entire conversation' },
  { value: 'selected', label: 'Selected messages' },
  { value: 'ai-only', label: 'AI answers only' },
  { value: 'user-only', label: 'My messages only' },
]

export interface SaveConversationDialogProps {
  open: boolean
  onClose: () => void
  conversationId: string
  conversationTitle: string
  workspaceId: string | null
  messages: ConversationNoteMessage[]
}

/**
 * UX-13.7.2 — "Save conversation → Notes": scope → title → workspace →
 * tags → note, exactly the flow from the brief. Deliberately does not use
 * useNotes()/useTags() — those hooks bind workspaceId to the currently
 * active workspace from context, but this dialog lets the user pick a
 * *different* target workspace, so it calls the underlying API functions
 * directly with an explicit workspaceId instead.
 *
 * Natural-language variants ("Save this conversation," "Save to Marketing
 * workspace," "Append to existing note," "Convert to article/checklist/…")
 * are explicitly out of scope for this pass — the brief calls them out as
 * "Later."
 */
export function SaveConversationDialog({
  open,
  onClose,
  conversationId,
  conversationTitle,
  workspaceId,
  messages,
}: SaveConversationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { user } = useAuth()
  const { workspaces } = useWorkspace()

  const [scope, setScope] = useState<ConversationSaveScope>('entire')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState(conversationTitle)
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(workspaceId)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)
  // UX-14.4 Phase 1 — Save As: pre-filled from the deterministic detector,
  // overridable by the user. `kindTouched` stops the auto-detect effect
  // below from clobbering a manual choice when `scope` changes afterward.
  const [artifactKind, setArtifactKind] = useState<ArtifactKind>('note')
  const [kindTouched, setKindTouched] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Reset to a fresh form each time the dialog opens for a (possibly
  // different) conversation, rather than carrying over the previous run's
  // state — same "reset on reopen" contract as InlineTextForm/ConfirmDialog.
  useEffect(() => {
    if (!open) return
    setScope('entire')
    setSelectedIds(new Set())
    setTitle(conversationTitle)
    setTargetWorkspaceId(workspaceId)
    setTags([])
    setTagInput('')
    setSavedNoteId(null)
    setArtifactKind('note')
    setKindTouched(false)
  }, [open, conversationTitle, workspaceId])

  const filtered = filterMessagesForScope({ messages, scope, selectedMessageIds: selectedIds })

  // Re-detect whenever what's being saved changes (scope/selection), but
  // only until the user picks a kind themselves — same "suggest, don't
  // override a real choice" rule Save As follows everywhere else.
  useEffect(() => {
    if (kindTouched || filtered.length === 0) return
    setArtifactKind(detectArtifactKind(formatConversationAsNoteContent(filtered)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, kindTouched])

  const save = useMutation({
    mutationFn: async () => {
      const content = formatConversationAsNoteContent(filtered)
      const sourceChunkIds = collectSourceChunkIds(filtered)
      const note = await createNote({
        userId: user!.id,
        workspaceId: targetWorkspaceId,
        title: title.trim() || conversationTitle,
        content,
        sourceChunkIds: sourceChunkIds.length > 0 ? sourceChunkIds : null,
        generationMetadata: buildArtifactGenerationMetadata(content, artifactKind, withCreationMethod(null, 'conversation_saved')),
      })
      await Promise.all(tags.map((tagName) => addTagToNote({ noteId: note.id, tagName, userId: user!.id })))
      await linkNoteToConversation({ userId: user!.id, workspaceId: targetWorkspaceId, noteId: note.id, conversationId })
      // Same indexing/linking contract every other note-creation path in
      // this codebase follows (saveMessageToNote, useMergeNotes,
      // generateBriefing) — this dialog was the one path still missing it.
      void indexNote(note, targetWorkspaceId)
      void linkKnownConceptsToSource({ userId: user!.id, sourceType: 'note', sourceId: note.id, text: `${note.title}\n\n${note.content}` })
      return note
    },
    onSuccess: (note) => setSavedNoteId(note.id),
  })

  function addTagFromInput() {
    const name = tagInput.trim().toLowerCase()
    if (name && !tags.includes(name)) setTags((current) => [...current, name])
    setTagInput('')
  }

  function toggleMessage(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      className="w-full max-w-lg rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] p-6 shadow-floating backdrop:bg-black/30"
    >
      {savedNoteId ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Saved to Notes</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">This conversation is now a note you can find, edit, and tag independently.</p>
          <div className="flex justify-end gap-2">
            <Link to={`/notes/${savedNoteId}`} className="text-sm text-[var(--color-accent)] hover:underline">
              View note →
            </Link>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Save conversation to Notes</h2>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--color-ink)]">What to save</span>
            <div className="flex flex-col gap-1">
              {SCOPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input
                    type="radio"
                    name="save-scope"
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className="accent-[var(--color-accent)]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {scope === 'selected' && (
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2">
              {messages.length === 0 ? (
                <p className="p-2 text-xs text-[var(--color-ink-muted)]">No messages in this conversation yet.</p>
              ) : (
                messages.map((message) => (
                  <label key={message.id} className="flex items-start gap-2 rounded-control px-2 py-1.5 text-xs hover:bg-[var(--surface-raised)]">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(message.id)}
                      onChange={() => toggleMessage(message.id)}
                      className="mt-0.5 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-[var(--color-ink)]">{message.role === 'user' ? 'You: ' : 'NOVA: '}</span>
                      <span className="text-[var(--color-ink-muted)]">
                        {message.content.length > 120 ? `${message.content.slice(0, 120)}…` : message.content}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          )}

          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Save as</span>
            <select
              value={artifactKind}
              onChange={(e) => {
                setArtifactKind(e.target.value as ArtifactKind)
                setKindTouched(true)
              }}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] shadow-inset outline-none"
            >
              {ARTIFACT_KIND_ORDER.map((kind) => (
                <option key={kind} value={kind}>
                  {ARTIFACT_KIND_DEFINITIONS[kind].label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Workspace</span>
            <select
              value={targetWorkspaceId ?? ''}
              onChange={(e) => setTargetWorkspaceId(e.target.value || null)}
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] shadow-inset outline-none"
            >
              <option value="">No workspace</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--color-ink)]">Tags</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]">
                  {tag}
                  <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => setTags((current) => current.filter((t) => t !== tag))} className="hover:text-[var(--color-ink)]">
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTagFromInput()
                  }
                }}
                onBlur={addTagFromInput}
                placeholder="Add a tag, press Enter"
                className="min-w-[8rem] flex-1 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2 py-1 text-xs text-[var(--color-ink)] outline-none"
              />
            </div>
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-amber-600">
              {scope === 'selected' ? 'Select at least one message to save.' : 'Nothing to save yet — this conversation has no messages of this kind.'}
            </p>
          )}

          {save.isError && <p className="text-sm text-red-600">{save.error instanceof Error ? save.error.message : 'Failed to save'}</p>}

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={save.isPending} disabled={filtered.length === 0} onClick={() => save.mutate()}>
              Save to Notes
            </Button>
          </div>
        </div>
      )}
    </dialog>
  )
}
