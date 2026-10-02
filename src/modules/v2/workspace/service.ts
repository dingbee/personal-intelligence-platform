import type { ResourceMetadata, TeamMembership, UUID, WorkspaceMembership } from '../domain/model'
import type { V2ScopeContext } from '../domain/scope'
import { assertScope } from '../domain/scope'
import { V2ControlPlaneStore } from '../control-plane/store'

export type WorkspaceAccessDecision =
  | { allowed: true; membership: WorkspaceMembership }
  | { allowed: false; reason: 'no_membership' | 'membership_inactive' }

export function createWorkspaceMembership(
  store: V2ControlPlaneStore,
  input: { organizationId: UUID; workspaceId: UUID; userId: UUID; roleId: UUID },
  metadata: Pick<ResourceMetadata, 'createdAt' | 'updatedAt'>,
): WorkspaceMembership {
  const membership: WorkspaceMembership = {
    id: input.workspaceId + ':' + input.userId,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    roleId: input.roleId,
    status: 'active',
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }
  store.save('workspaceMembership', membership)
  return membership
}

export function createTeamMembership(
  store: V2ControlPlaneStore,
  input: { organizationId: UUID; workspaceId: UUID; teamId: UUID; userId: UUID; roleId?: UUID },
  metadata: Pick<ResourceMetadata, 'createdAt' | 'updatedAt'>,
): TeamMembership {
  const membership: TeamMembership = {
    id: input.teamId + ':' + input.userId,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    teamId: input.teamId,
    userId: input.userId,
    roleId: input.roleId,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    status: 'active',
  }
  store.save('teamMembership', membership)
  return membership
}

export function resolveWorkspaceAccess(
  store: V2ControlPlaneStore,
  workspaceId: UUID,
  userId: UUID,
  context: V2ScopeContext,
): WorkspaceAccessDecision {
  const workspace = store.getScoped('workspace', workspaceId, context)
  if (!workspace) return { allowed: false, reason: 'no_membership' }

  const memberships = store.list('workspaceMembership', {
    organizationId: context.organizationId,
    workspaceId,
  })
  const membership = memberships.find((item) => item.userId === userId)
  if (!membership) return { allowed: false, reason: 'no_membership' }
  if (membership.status !== 'active') return { allowed: false, reason: 'membership_inactive' }

  assertScope(membership, context)
  return { allowed: true, membership }
}
