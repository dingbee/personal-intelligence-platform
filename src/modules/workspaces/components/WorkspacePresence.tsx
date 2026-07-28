import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useWorkspaceHeaderSummary } from '@/modules/workspaces/hooks/useWorkspaceHeaderSummary'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/**
 * The header's richer workspace indicator (Phase UX-3, upgraded in
 * UX-3.5 with an "active intelligence context" feel — a live-status dot,
 * last-activity signal, tactile hover) — distinct from the Sidebar's
 * compact WorkspaceSwitcher <select>, which is untouched and still the
 * fast day-to-day way to switch.
 */
export function WorkspacePresence() {
  const navigate = useNavigate()
  const { workspaces, currentWorkspaceId, setCurrentWorkspaceId, create } = useWorkspace()
  const { data: summary } = useWorkspaceHeaderSummary(currentWorkspaceId)
  const [creating, setCreating] = useState(false)

  const current = workspaces.find((w) => w.id === currentWorkspaceId)
  const label = current?.name ?? 'All workspaces'
  const documentCount = summary?.documentCount ?? 0

  if (creating) {
    return (
      <div className="w-44">
        <InlineTextForm
          placeholder="Workspace name"
          onSubmit={(name) => {
            create.mutate(name)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      </div>
    )
  }

  return (
    <DropdownMenu
      trigger={
        <span className="flex items-center gap-1.5 rounded-control px-1.5 py-1 text-right leading-tight transition-colors hover:bg-[var(--surface-base)]">
          <span className="flex flex-col items-end">
            <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-ink)]">
              <span aria-hidden className="text-[var(--color-accent)]">
                ◉
              </span>
              <span className="max-w-[9rem] truncate">{label}</span>
            </span>
            <span className="whitespace-nowrap text-xs text-[var(--color-ink-muted)]">
              {documentCount} document{documentCount === 1 ? '' : 's'}
              {summary?.lastActivityAt && (
                <span className="hidden sm:inline"> · Updated {formatRelativeTime(summary.lastActivityAt)}</span>
              )}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-[var(--color-ink-muted)]">
            ⌄
          </span>
        </span>
      }
    >
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <p className="text-xs text-[var(--color-ink-muted)]">Current workspace</p>
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">{label}</p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          {documentCount} document{documentCount === 1 ? '' : 's'}
          {summary?.lastActivityAt && ` · Updated ${formatRelativeTime(summary.lastActivityAt)}`}
        </p>
      </div>
      {currentWorkspaceId !== null && (
        <DropdownMenuItem onClick={() => setCurrentWorkspaceId(null)}>Switch to All workspaces</DropdownMenuItem>
      )}
      {workspaces
        .filter((workspace) => workspace.id !== currentWorkspaceId)
        .map((workspace) => (
          <DropdownMenuItem key={workspace.id} onClick={() => setCurrentWorkspaceId(workspace.id)}>
            Switch to {workspace.name}
          </DropdownMenuItem>
        ))}
      <DropdownMenuItem onClick={() => navigate('/settings/workspaces')}>Manage workspaces</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setCreating(true)}>+ New workspace</DropdownMenuItem>
    </DropdownMenu>
  )
}
