import type { Permission, Role, UUID, WorkspaceMembership } from '../domain/model'
import type { V2ScopeContext } from '../domain/scope'
import { assertScope } from '../domain/scope'
import { V2ControlPlaneStore } from '../control-plane/store'

export type AuthorizationRequest = {
  userId: UUID
  permission: string
  context: V2ScopeContext
}

export type AuthorizationDecision =
  | { allowed: true; roleId: UUID; permission: string }
  | { allowed: false; reason: 'no_membership' | 'membership_inactive' | 'role_missing' | 'permission_missing' }

export function authorize(
  store: V2ControlPlaneStore,
  request: AuthorizationRequest,
): AuthorizationDecision {
  const membership = findMembership(store, request.context.workspaceId, request.userId, request.context)
  if (!membership) return { allowed: false, reason: 'no_membership' }
  if (membership.status !== 'active') return { allowed: false, reason: 'membership_inactive' }

  const role = store.getScoped('role', membership.roleId, request.context) as Role | undefined
  if (!role) return { allowed: false, reason: 'role_missing' }

  const permission = role.permissions
    .map((id) => store.getScoped('permission', id, request.context) as Permission | undefined)
    .find((item) => item?.key === request.permission)

  if (!permission) return { allowed: false, reason: 'permission_missing' }

  return { allowed: true, roleId: role.id, permission: permission.key }
}

function findMembership(
  store: V2ControlPlaneStore,
  workspaceId: UUID | undefined,
  userId: UUID,
  context: V2ScopeContext,
): WorkspaceMembership | undefined {
  if (!workspaceId) return undefined
  assertScope({ organizationId: context.organizationId, workspaceId }, context)
  return store.list('workspaceMembership', {
    organizationId: context.organizationId,
    workspaceId,
  }).find((item) => item.userId === userId)
}
