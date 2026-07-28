import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useWorkspaceDocumentCount } from '@/modules/workspaces/hooks/useWorkspaceDocumentCount'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

/**
 * The header's richer workspace indicator (Phase UX-3) — a live summary +
 * quick actions, distinct from the Sidebar's compact WorkspaceSwitcher
 * <select>, which is untouched and still the fast day-to-day way to switch.
 */
export function WorkspacePresence() {
  const navigate = useNavigate()
  const { workspaces, currentWorkspaceId, setCurrentWorkspaceId, create } = useWorkspace()
  const { data: documentCount } = useWorkspaceDocumentCount(currentWorkspaceId)
  const [creating, setCreating] = useState(false)

  const current = workspaces.find((w) => w.id === currentWorkspaceId)
  const label = current?.name ?? 'All workspaces'

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
        <span className="block text-right leading-tight">
          <span className="block text-[0.65rem] uppercase tracking-wide text-[var(--color-ink-muted)]">Workspace</span>
          <span className="block max-w-[10rem] truncate text-sm font-medium text-[var(--color-ink)]">{label} ▾</span>
        </span>
      }
    >
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <p className="text-xs text-[var(--color-ink-muted)]">Current workspace</p>
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">{label}</p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          {documentCount ?? 0} document{documentCount === 1 ? '' : 's'}
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
