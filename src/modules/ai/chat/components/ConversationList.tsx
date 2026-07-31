import { useState } from 'react'
import type { Conversation } from '@/shared/types/database'
import { Button } from '@/shared/components/ui/Button'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { groupConversationsByRecency } from '@/modules/ai/chat/groupConversationsByRecency'

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

  function renderRow(conversation: Conversation) {
    return (
      <div
        key={conversation.id}
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
            className="flex min-w-0 flex-1 items-center gap-1 truncate px-3 py-2 text-left"
          >
            {conversation.is_pinned && (
              <span aria-label="Pinned" className="shrink-0 text-xs">
                📌
              </span>
            )}
            {conversation.favorite && (
              <span aria-label="Favorite" className="shrink-0 text-xs text-amber-500">
                ★
              </span>
            )}
            <span className="truncate">{conversation.title}</span>
          </button>
        )}
        <DropdownMenu trigger={<span aria-label="Conversation actions">⋯</span>}>
          {mode === 'active' ? (
            <>
              <DropdownMenuItem onClick={() => setRenamingId(conversation.id)}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTogglePin(conversation.id, !conversation.is_pinned)}>
                {conversation.is_pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleFavorite(conversation.id, !conversation.favorite)}>
                {conversation.favorite ? 'Remove favorite' : 'Add to favorites'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(conversation.id)}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(conversation.id)}>Archive</DropdownMenuItem>
              <DropdownMenuItem danger onClick={() => setConfirmDeleteId(conversation.id)}>
                Delete
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => onRestore(conversation.id)}>Restore</DropdownMenuItem>
              <DropdownMenuItem danger onClick={() => setConfirmDeleteId(conversation.id)}>
                Delete permanently
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenu>
      </div>
    )
  }

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
                {group.conversations.map((conversation) => renderRow(conversation))}
              </div>
            ))
          : conversations.map((conversation) => renderRow(conversation))}
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
