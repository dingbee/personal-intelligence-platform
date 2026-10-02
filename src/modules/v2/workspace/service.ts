import type { ResourceMetadata, TeamMembership, UUID, WorkspaceMembership, WorkspaceMembershipStatus } from '../domain/model'
import type { V2ScopeContext } from '../domain/scope'
import { assertScope } from '../domain/scope'
import { V2ControlPlaneStore } from '../control-plane/store'

export type WorkspaceAccessDecision =
  | { allowed: true; membership: WorkspaceMembership }
  | { allowed: false; reason: 'no_membership' | 'membership_inactive' | 'workspace_inactive' }

type MembershipMetadata = Pick<ResourceMetadata, 'createdAt' | 'updatedAt'>

export function createWorkspaceMembership(
  store: V2ControlPlaneStore,
  input: { organizationId: UUID; workspaceId: UUID; userId: UUID; roleId: UUID; invitedBy?: UUID; status?: WorkspaceMembershipStatus },
  metadata: MembershipMetadata,
): WorkspaceMembership {
  const membership: WorkspaceMembership = {
    id: input.workspaceId + ':' + input.userId,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    roleId: input.roleId,
    status: input.status ?? 'active',
    invitedBy: input.invitedBy,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }
  store.save('workspaceMembership', membership)
  return membership
}

export function updateWorkspaceMembership(
  store: V2ControlPlaneStore,
  membershipId: UUID,
  input: { roleId?: UUID; status?: WorkspaceMembershipStatus; invitedBy?: UUID },
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): WorkspaceMembership {
  const membership = store.get('workspaceMembership', membershipId)
  if (!membership) throw new Error('V2 workspace membership does not exist.')

  const updated: WorkspaceMembership = {
    ...membership,
    roleId: input.roleId ?? membership.roleId,
    status: input.status ?? membership.status,
    invitedBy: input.invitedBy ?? membership.invitedBy,
    updatedAt: metadata.updatedAt,
  }
  store.replace('workspaceMembership', updated)
  return updated
}

export function setWorkspaceMembershipStatus(
  store: V2ControlPlaneStore,
  membershipId: UUID,
  status: WorkspaceMembershipStatus,
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): WorkspaceMembership {
  return updateWorkspaceMembership(store, membershipId, { status }, metadata)
}

export function createTeamMembership(
  store: V2ControlPlaneStore,
  input: { organizationId: UUID; workspaceId: UUID; teamId: UUID; userId: UUID; roleId?: UUID },
  metadata: MembershipMetadata,
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
  if (workspace.status !== 'active') {
    return { allowed: false, reason: 'workspace_inactive' }
  }

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
