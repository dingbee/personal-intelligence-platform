import { useState } from 'react'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspaceId, setCurrentWorkspaceId, create } = useWorkspace()
  const [creating, setCreating] = useState(false)

  if (creating) {
    return (
      <div className="mb-4 px-2">
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
    <div className="mb-4 px-2">
      <select
        aria-label="Workspace"
        value={currentWorkspaceId ?? ''}
        onChange={(e) => {
          if (e.target.value === '__new__') setCreating(true)
          else setCurrentWorkspaceId(e.target.value || null)
        }}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm font-medium text-[var(--color-ink)]"
      >
        <option value="">All workspaces</option>
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
        <option value="__new__">+ New workspace…</option>
      </select>
    </div>
  )
}
