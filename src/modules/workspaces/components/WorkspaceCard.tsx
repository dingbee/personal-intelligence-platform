import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Workspace } from '@/shared/types/database'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useWorkspaceManagement } from '@/modules/workspaces/hooks/useWorkspaceManagement'
import { useWorkspaceStats } from '@/modules/workspaces/hooks/useWorkspaceStats'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Spinner } from '@/shared/components/ui/Spinner'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import { formatFileSize } from '@/modules/library/utils/fileTypes'

export function WorkspaceCard({
  workspace,
  isFirst,
  isLast,
}: {
  workspace: Workspace
  isFirst: boolean
  isLast: boolean
}) {
  const navigate = useNavigate()
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspace()
  const { rename, archive, restore, remove, move } = useWorkspaceManagement()
  const { data: stats, isLoading: statsLoading } = useWorkspaceStats(workspace.id)
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isCurrent = currentWorkspaceId === workspace.id
  const isArchived = Boolean(workspace.archived_at)

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        isArchived
          ? 'border-dashed border-[var(--color-border)] bg-[var(--color-canvas)] opacity-70'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {renaming ? (
              <InlineTextForm
                initialValue={workspace.name}
                onSubmit={(name) => {
                  rename.mutate({ id: workspace.id, name })
                  setRenaming(false)
                }}
                onCancel={() => setRenaming(false)}
              />
            ) : (
              <h3 className="truncate font-medium text-[var(--color-ink)]" title={workspace.name}>
                {workspace.name}
              </h3>
            )}
            {isCurrent && (
              <span className="shrink-0 rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                Current workspace
              </span>
            )}
            {isArchived && (
              <span className="shrink-0 rounded-full bg-[var(--color-ink-muted)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
                Archived
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            Created {formatRelativeTime(workspace.created_at)}
            {isArchived && workspace.archived_at && ` · Archived ${formatRelativeTime(workspace.archived_at)}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!isArchived && (
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Move up"
                disabled={isFirst || move.isPending}
                onClick={() => move.mutate({ direction: 'up', workspace })}
                className="rounded px-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={isLast || move.isPending}
                onClick={() => move.mutate({ direction: 'down', workspace })}
                className="rounded px-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30"
              >
                ▼
              </button>
            </div>
          )}
          <DropdownMenu trigger={<span aria-hidden>⋯</span>}>
            {!isArchived && (
              <DropdownMenuItem
                onClick={() => {
                  setCurrentWorkspaceId(workspace.id)
                  navigate('/library')
                }}
              >
                Open
              </DropdownMenuItem>
            )}
            {!isArchived && !isCurrent && (
              <DropdownMenuItem onClick={() => setCurrentWorkspaceId(workspace.id)}>Set as default</DropdownMenuItem>
            )}
            {!isArchived && <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>}
            {isArchived ? (
              <DropdownMenuItem onClick={() => restore.mutate(workspace.id)}>Restore</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => archive.mutate(workspace.id)}>Archive</DropdownMenuItem>
            )}
            <DropdownMenuItem danger onClick={() => setConfirmingDelete(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>

      {statsLoading || !stats ? (
        <Spinner size="sm" />
      ) : (
        <div className="flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
          <p>
            {stats.documents} document{stats.documents === 1 ? '' : 's'} · {stats.collections} collection
            {stats.collections === 1 ? '' : 's'} · {stats.notes} note{stats.notes === 1 ? '' : 's'} ·{' '}
            {stats.conversations} conversation{stats.conversations === 1 ? '' : 's'}
          </p>
          <p>
            {stats.knowledgeNodes} knowledge node{stats.knowledgeNodes === 1 ? '' : 's'} · {stats.highlights} highlight
            {stats.highlights === 1 ? '' : 's'} · {stats.flashcards} flashcard{stats.flashcards === 1 ? '' : 's'} ·{' '}
            {stats.chapterSummaries} chapter summar{stats.chapterSummaries === 1 ? 'y' : 'ies'}
          </p>
          <p>
            Storage: {formatFileSize(stats.storageBytes)} · Last activity:{' '}
            {stats.lastActivityAt ? formatRelativeTime(stats.lastActivityAt) : 'none yet'}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${workspace.name}"?`}
        description={
          stats
            ? `This workspace contains ${stats.documents} document${stats.documents === 1 ? '' : 's'}, ${stats.notes} note${
                stats.notes === 1 ? '' : 's'
              }, and ${stats.conversations} conversation${
                stats.conversations === 1 ? '' : 's'
              }. Deleting the workspace won't delete that content — it moves to the unscoped "All" view. This can't be undone.`
            : "Deleting the workspace won't delete its content — it moves to the unscoped \"All\" view. This can't be undone."
        }
        confirmLabel="Delete"
        onConfirm={() => {
          remove.mutate(workspace.id)
          setConfirmingDelete(false)
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
