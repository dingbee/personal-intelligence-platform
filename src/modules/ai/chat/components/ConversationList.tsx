import { useState } from 'react'
import type { Conversation } from '@/shared/types/database'
import { Button } from '@/shared/components/ui/Button'
import { ActionMenu, type ResolvedAction } from '@/shared/components/actions/ActionMenu'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { groupConversationsByRecency } from '@/modules/ai/chat/groupConversationsByRecency'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspaceRole } from '@/modules/workspaces/hooks/useWorkspaceRole'
import { useWorkspaceMemberDirectory } from '@/modules/workspaces/hooks/useWorkspaceMemberDirectory'
import { SharingBadge } from '@/shared/components/collaboration/SharingBadge'

export interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onArchive: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onTogglePin: (id: string, isPinned: boolean) => void
  onToggleFavorite: (id: string, favorite: boolean) => void
  /** UX-13.5B — 'active' shows Rename/Duplicate/Archive/Delete; 'archived' shows Restore/Delete instead (an archived conversation is restored before it's renamed or duplicated). */
  mode: 'active' | 'archived'
  archivedCount: number
  onToggleMode: () => void
  /** UX-13.5 Phase 9 — searches title + message content across active conversations; `conversations` is already whatever the caller decided to show (search results, active, or archived), this prop only drives the input itself. */
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}

interface ConversationRowProps {
  conversation: Conversation
  selectedId: string | null
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onArchive: (id: string) => void
  onDuplicate: (id: string) => void
  onTogglePin: (id: string, isPinned: boolean) => void
  onToggleFavorite: (id: string, favorite: boolean) => void
  onRestore: (id: string) => void
  mode: 'active' | 'archived'
  renamingId: string | null
  setRenamingId: (id: string | null) => void
  setConfirmDeleteId: (id: string | null) => void
}

/**
 * UX-14.5 Phase 5 — split out of what used to be a plain `renderRow`
 * function so `useWorkspaceRole` can be called legitimately (hooks can't
 * run inside a function invoked from `.map()`, only inside a real
 * component). Gating mirrors NoteCard/DocumentCard/ImageCard exactly.
 */
function ConversationRow({
  conversation,
  selectedId,
  onSelect,
  onRename,
  onArchive,
  onDuplicate,
  onTogglePin,
  onToggleFavorite,
  onRestore,
  mode,
  renamingId,
  setRenamingId,
  setConfirmDeleteId,
}: ConversationRowProps) {
  const { user } = useAuth()
  const { data: role } = useWorkspaceRole(conversation.workspace_id)
  const { isShared } = useWorkspaceMemberDirectory(conversation.workspace_id)
  const isConversationOwner = conversation.user_id === user?.id
  const canEdit = isConversationOwner || role === 'editor' || role === 'owner'
  const canDelete = isConversationOwner || role === 'owner'

  const activeActions: ResolvedAction[] = [
    ...(canEdit ? [{ id: 'rename' as const, label: 'Rename', onSelect: () => setRenamingId(conversation.id) }] : []),
    {
      id: 'pin',
      label: conversation.is_pinned ? 'Unpin' : 'Pin',
      onSelect: () => onTogglePin(conversation.id, !conversation.is_pinned),
    },
    {
      id: 'favorite',
      label: conversation.favorite ? 'Remove favorite' : 'Add to favorites',
      onSelect: () => onToggleFavorite(conversation.id, !conversation.favorite),
    },
    ...(canEdit ? [{ id: 'duplicate' as const, label: 'Duplicate', onSelect: () => onDuplicate(conversation.id) }] : []),
    ...(canEdit ? [{ id: 'archive' as const, label: 'Archive', onSelect: () => onArchive(conversation.id) }] : []),
    ...(canDelete ? [{ id: 'delete' as const, label: 'Delete', onSelect: () => setConfirmDeleteId(conversation.id) }] : []),
  ]

  const archivedActions: ResolvedAction[] = [
    ...(canEdit ? [{ id: 'archive' as const, label: 'Restore', onSelect: () => onRestore(conversation.id) }] : []),
    ...(canDelete ? [{ id: 'delete' as const, label: 'Delete permanently', onSelect: () => setConfirmDeleteId(conversation.id) }] : []),
  ]

  return (
    <div
      className={`group flex items-center gap-1 rounded-lg pr-1 text-sm ${
        conversation.id === selectedId
          ? 'bg-[var(--color-canvas)] text-[var(--color-ink)]'
          : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'
      }`}
    >
      {renamingId === conversation.id ? (
        <div className="flex-1 px-2 py-1">
          <InlineTextForm
            initialValue={conversation.title}
            onSubmit={(title) => {
              setRenamingId(null)
              if (title !== conversation.title) onRename(conversation.id, title)
            }}
            onCancel={() => setRenamingId(null)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(conversation.id)}
          className="flex min-w-0 flex-1 items-center gap-1 px-3 py-2 text-left"
        >
          {conversation.is_pinned && (
            <span aria-label="Pinned" className="shrink-0 text-xs">
              📌
            </span>
          )}
          {conversation.favorite && (
            <span aria-label="Favorite" className="shrink-0 text-xs text-[var(--color-warning)]">
              ★
            </span>
          )}
          <span className="min-w-0 truncate">{conversation.title}</span>
          {isShared && (
            <span className="shrink-0">
              <SharingBadge isShared />
            </span>
          )}
        </button>
      )}
      <ActionMenu
        actions={mode === 'active' ? activeActions : archivedActions}
        trigger={<span aria-label="Conversation actions">⋯</span>}
      />
    </div>
  )
}

/**
 * The actual list content — no chrome of its own, so it can be reused by
 * the persistent desktop panel below and MobileConversationDrawer without
 * duplicating this markup. Same split as Sidebar/SidebarNav.
 */
export function ConversationListContent({
  conversations,
  selectedId,
  onSelect,
  onNew,
  onRename,
  onArchive,
  onDuplicate,
  onDelete,
  onRestore,
  onTogglePin,
  onToggleFavorite,
  mode,
  archivedCount,
  onToggleMode,
  searchQuery,
  onSearchQueryChange,
}: ConversationListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const searching = searchQuery.trim().length > 0

  return (
    <>
      <div className="flex flex-col gap-2 p-3">
        {mode === 'active' && (
          <Button onClick={onNew} className="w-full">
            New chat
          </Button>
        )}
        {mode === 'active' && (
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm shadow-inset outline-none"
          />
        )}
        {!searching && (
          <button
            type="button"
            onClick={onToggleMode}
            className="self-start text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:underline"
          >
            {mode === 'active' ? `Archived (${archivedCount})` : '← Back to conversations'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <p className="px-3 py-2 text-xs text-[var(--color-ink-muted)]">
            {searching ? 'No conversations match your search.' : mode === 'active' ? 'No conversations yet.' : 'No archived conversations.'}
          </p>
        )}
        {/* UX-13.6 Phase 3 — Today/Yesterday/This Week/Last Month/Older grouping applies only to the plain active list; archived and search results stay a flat list (already ordered by their own most-relevant sort) rather than being regrouped by recency too. */}
        {mode === 'active' && !searching
          ? groupConversationsByRecency(conversations).map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-[var(--color-ink-muted)]">{group.label}</p>
                {group.conversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onRename={onRename}
                    onArchive={onArchive}
                    onDuplicate={onDuplicate}
                    onTogglePin={onTogglePin}
                    onToggleFavorite={onToggleFavorite}
                    onRestore={onRestore}
                    mode={mode}
                    renamingId={renamingId}
                    setRenamingId={setRenamingId}
                    setConfirmDeleteId={setConfirmDeleteId}
                  />
                ))}
              </div>
            ))
          : conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selectedId={selectedId}
                onSelect={onSelect}
                onRename={onRename}
                onArchive={onArchive}
                onDuplicate={onDuplicate}
                onTogglePin={onTogglePin}
                onToggleFavorite={onToggleFavorite}
                onRestore={onRestore}
                mode={mode}
                renamingId={renamingId}
                setRenamingId={setRenamingId}
                setConfirmDeleteId={setConfirmDeleteId}
              />
            ))}
      </div>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this conversation?"
        description="This permanently deletes the conversation and every message in it. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDeleteId) onDelete(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  )
}

/** Persistent on desktop only (md:flex) — below md, MobileConversationDrawer is how a conversation gets picked/created/deleted instead. */
export function ConversationList(props: ConversationListProps) {
  return (
    <div className="hidden h-full w-64 shrink-0 flex-col border-r border-[var(--color-border)] md:flex">
      <ConversationListContent {...props} />
    </div>
  )
}
