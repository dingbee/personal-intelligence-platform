import type { Permission, Policy, Role, UUID, WorkspaceMembership } from '../domain/model'
import type { AutonomyLevel } from '../domain/autonomy'
import { autonomyAtMost } from '../domain/autonomy'
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

export type GovernanceRequest = {
  userId: UUID
  permission: string
  resource: {
    organizationId: UUID
    workspaceId?: UUID
    resourceType: string
    action: string
    resourceId?: UUID
  }
  context: V2ScopeContext
  requestedAutonomy?: AutonomyLevel
  requiresApproval?: boolean
  approvalId?: UUID
  attributes?: Record<string, unknown>
}

export type GovernanceAuditRecord = {
  userId: UUID
  organizationId: UUID
  workspaceId?: UUID
  resourceType: string
  action: string
  decision: 'allowed' | 'denied' | 'approval_required'
  reason: string
  roleId?: UUID
  policyIds: UUID[]
}

export type GovernanceDecision =
  | { allowed: true; decision: 'allowed'; roleId: UUID; policyIds: UUID[]; audit: GovernanceAuditRecord }
  | { allowed: false; decision: 'denied' | 'approval_required'; reason: GovernanceReason; policyIds: UUID[]; audit: GovernanceAuditRecord }

export type GovernanceReason =
  | 'tenant_scope_violation'
  | 'authorization_denied'
  | 'policy_denied'
  | 'policy_not_satisfied'
  | 'autonomy_exceeded'
  | 'approval_required'
  | 'approval_not_granted'

/**
 * V2-09 governance is a control-plane decision layer.
 *
 * It composes existing RBAC with explicit policy and autonomy checks. It does
 * not execute tools, agents or workflows and does not replace NoVA enforcement.
 * Every decision carries an auditable scope and policy reference set.
 */
export function govern(
  store: V2ControlPlaneStore,
  request: GovernanceRequest,
): GovernanceDecision {
  try {
    assertScope(
      {
        organizationId: request.resource.organizationId,
        workspaceId: request.resource.workspaceId,
      },
      request.context,
    )
  } catch {
    return denied(request, 'tenant_scope_violation', [])
  }

  const authorization = authorize(store, {
    userId: request.userId,
    permission: request.permission,
    context: request.context,
  })

  if (!authorization.allowed) {
    return denied(request, 'authorization_denied', [])
  }

  const policies = store.list('policy', request.context)
  const applicablePolicies = policies.filter((policy) =>
    policy.rules.some((rule) =>
      matchesRule(rule.resource, rule.action, request.resource.resourceType, request.resource.action),
    ),
  )

  const deniedPolicies = applicablePolicies.filter((policy) =>
    policy.effect === 'deny' &&
    policy.rules.some((rule) =>
      matchesRule(rule.resource, rule.action, request.resource.resourceType, request.resource.action) &&
      matchesConditions(rule.conditions, request.attributes),
    ),
  )

  if (deniedPolicies.length > 0) {
    return denied(
      request,
      'policy_denied',
      deniedPolicies.map((policy) => policy.id),
      authorization.roleId,
    )
  }

  const allowingPolicies = applicablePolicies.filter((policy) =>
    policy.effect === 'allow' &&
    policy.rules.some((rule) =>
      matchesRule(rule.resource, rule.action, request.resource.resourceType, request.resource.action) &&
      matchesConditions(rule.conditions, request.attributes),
    ),
  )

  if (applicablePolicies.length > 0 && allowingPolicies.length === 0) {
    return denied(
      request,
      'policy_not_satisfied',
      applicablePolicies.map((policy) => policy.id),
      authorization.roleId,
    )
  }

  const requested = request.requestedAutonomy ?? 'inform'
  const maximum = allowingPolicies.length === 0
    ? 'inform'
    : allowingPolicies.reduce<AutonomyLevel>((ceiling, policy) => {
        const policyCeiling = policy.maximumAutonomy ?? 'inform'
        return autonomyAtMost(policyCeiling, ceiling) ? policyCeiling : ceiling
      }, 'bounded')

  if (!autonomyAtMost(requested, maximum)) {
    return denied(
      request,
      'autonomy_exceeded',
      allowingPolicies.map((policy) => policy.id),
      authorization.roleId,
    )
  }

  if (request.requiresApproval) {
    if (!request.approvalId) {
      return {
        allowed: false,
        decision: 'approval_required',
        reason: 'approval_required',
        policyIds: allowingPolicies.map((policy) => policy.id),
        audit: audit(request, 'approval_required', 'approval_required', authorization.roleId, allowingPolicies),
      }
    }

    const approval = store.getScoped('approval', request.approvalId, request.context)
    const approvalMatchesResource = Boolean(
      approval &&
      approval.subjectType === request.resource.resourceType &&
      request.resource.resourceId &&
      approval.subjectId === request.resource.resourceId,
    )

    if (!approval || !approvalMatchesResource || approval.status !== 'active' || approval.decision !== 'approved' || (approval.expiresAt && Date.parse(approval.expiresAt) <= Date.now())) {
      return {
        allowed: false,
        decision: 'approval_required',
        reason: 'approval_not_granted',
        policyIds: allowingPolicies.map((policy) => policy.id),
        audit: audit(request, 'approval_required', 'approval_not_granted', authorization.roleId, allowingPolicies),
      }
    }
  }

  return {
    allowed: true,
    decision: 'allowed',
    roleId: authorization.roleId,
    policyIds: allowingPolicies.map((policy) => policy.id),
    audit: audit(request, 'allowed', 'governed', authorization.roleId, allowingPolicies),
  }
}

function matchesRule(
  resourcePattern: string,
  actionPattern: string,
  resourceType: string,
  action: string,
): boolean {
  return matchesPattern(resourcePattern, resourceType) && matchesPattern(actionPattern, action)
}

function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === '*' || pattern === value) return true
  if (pattern.endsWith('.*')) return value.startsWith(pattern.slice(0, -1))
  return false
}

function matchesConditions(
  conditions: Record<string, unknown> | undefined,
  attributes: Record<string, unknown> | undefined,
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true
  if (!attributes) return false

  return Object.entries(conditions).every(([key, expected]) => attributes[key] === expected)
}

function denied(
  request: GovernanceRequest,
  reason: GovernanceReason,
  policyIds: UUID[],
  roleId?: UUID,
): GovernanceDecision {
  const decision = reason === 'approval_required' ? 'approval_required' : 'denied'
  return {
    allowed: false,
    decision,
    reason,
    policyIds,
    audit: audit(request, decision, reason, roleId, policyIds.map((id) => ({ id } as Policy))),
  }
}

function audit(
  request: GovernanceRequest,
  decision: 'allowed' | 'denied' | 'approval_required',
  reason: string,
  roleId: UUID | undefined,
  policies: Pick<Policy, 'id'>[],
): GovernanceAuditRecord {
  return {
    userId: request.userId,
    organizationId: request.context.organizationId,
    workspaceId: request.context.workspaceId,
    resourceType: request.resource.resourceType,
    action: request.resource.action,
    decision,
    reason,
    roleId,
    policyIds: policies.map((policy) => policy.id),
  }
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
