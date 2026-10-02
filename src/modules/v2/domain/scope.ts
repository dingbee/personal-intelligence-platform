import type { ResourceScope, UUID } from './model'

/**
 * V2 resource scope is explicit and must be carried by every control-plane
 * operation. This helper is intentionally pure: authorization remains a
 * policy concern and persistence remains outside the domain layer.
 */
export interface V2ScopeContext {
  organizationId: UUID
  workspaceId?: UUID
  userId?: UUID
}

export function toResourceScope(context: V2ScopeContext): ResourceScope {
  return {
    organizationId: context.organizationId,
    workspaceId: context.workspaceId,
  }
}

export function isWithinScope(
  resource: ResourceScope,
  context: V2ScopeContext,
): boolean {
  if (resource.organizationId !== context.organizationId) return false

  if (resource.workspaceId !== undefined) {
    return resource.workspaceId === context.workspaceId
  }

  return true
}

/**
 * Fails closed when a scoped resource is used without the required
 * organization/workspace context.
 */
export function assertScope(
  resource: ResourceScope,
  context: V2ScopeContext,
): void {
  if (!isWithinScope(resource, context)) {
    throw new Error('V2 resource is outside the active organization/workspace scope.')
  }
}
