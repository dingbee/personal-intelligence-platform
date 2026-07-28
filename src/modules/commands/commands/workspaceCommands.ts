import type { Workspace } from '@/shared/types/database'
import type { Command, CommandContext } from '@/modules/commands/types'

export const manageWorkspacesCommand: Command = {
  id: 'workspace-manage',
  title: 'Switch workspace',
  description: 'View, switch, archive, or create workspaces',
  icon: '🏢',
  category: 'workspace',
  featured: true,
  execute: (_context, actions) => actions.navigate('/settings/workspaces'),
}

export const switchToAllWorkspacesCommand: Command = {
  id: 'workspace-switch-all',
  title: 'Switch to All workspaces',
  icon: '🏢',
  category: 'workspace',
  isAvailable: (context) => context.workspaceId !== null,
  execute: (_context, actions) => actions.setCurrentWorkspaceId(null),
}

/**
 * Not pre-registered — the user's workspace list isn't known until render
 * time, so the Command Bar generates one "Switch to X" command per
 * workspace on every open and mixes them into the same candidate pool
 * filterCommands works over. Excludes the current workspace (there's
 * nothing to switch to).
 */
export function buildWorkspaceSwitchCommands(workspaces: Workspace[], context: CommandContext): Command[] {
  return workspaces
    .filter((workspace) => workspace.id !== context.workspaceId)
    .map((workspace) => ({
      id: `workspace-switch-${workspace.id}`,
      title: `Switch to ${workspace.name}`,
      icon: '🏢',
      category: 'workspace',
      execute: (_ctx, actions) => actions.setCurrentWorkspaceId(workspace.id),
    }))
}
