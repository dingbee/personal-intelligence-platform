import type { UUID } from '../domain/model'
import type { V2ScopeContext } from '../domain/scope'
import { V2ControlPlaneStore } from '../control-plane/store'
import { govern, type AutonomyLevel, type GovernanceDecision } from '../workspace/authorization'

/**
 * V2-11 integration kernel.
 *
 * This is deliberately persistence-agnostic and execution-free.
 * ARRIYIA owns integration identity, capability registration and governance.
 * NoVA owns transport, external execution, retries, workers, MCP runtime and
 * durable execution state.
 */

export type IntegrationProtocol = 'api' | 'webhook' | 'mcp'
export type IntegrationStatus = 'draft' | 'active' | 'paused' | 'revoked'

export interface Integration {
  id: UUID
  organizationId: UUID
  workspaceId: UUID
  name: string
  provider: string
  protocol: IntegrationProtocol
  status: IntegrationStatus
  capabilities: string[]
  endpoint?: string
  credentialRef?: string
  createdAt: string
  updatedAt: string
}

export interface IntegrationOperationRequest {
  userId: UUID
  permission: string
  context: V2ScopeContext
  integrationId: UUID
  capability: string
  action: string
  input: Record<string, unknown>
  requestedAutonomy?: AutonomyLevel
  requiresApproval?: boolean
  approvalId?: UUID
  attributes?: Record<string, unknown>
}

export interface PreparedIntegrationOperation {
  integration: Integration
  capability: string
  action: string
  input: Record<string, unknown>
  governance: GovernanceDecision
}

export class IntegrationRegistry {
  private readonly integrations = new Map<UUID, Integration>()

  register(integration: Integration): void {
    if (!integration.id) throw new Error('V2 integration requires an id.')
    if (!integration.organizationId || !integration.workspaceId) {
      throw new Error('V2 integration requires organization and workspace scope.')
    }
    if (!integration.name.trim()) throw new Error('V2 integration requires a name.')
    if (!integration.provider.trim()) throw new Error('V2 integration requires a provider.')
    if (integration.capabilities.length === 0) {
      throw new Error('V2 integration requires at least one capability.')
    }
    if (new Set(integration.capabilities).size !== integration.capabilities.length) {
      throw new Error('V2 integration capabilities must be unique.')
    }
    if (this.integrations.has(integration.id)) {
      throw new Error('V2 integration already exists.')
    }
    this.integrations.set(integration.id, integration)
  }

  get(id: UUID): Integration | undefined {
    return this.integrations.get(id)
  }

  getScoped(id: UUID, context: V2ScopeContext): Integration | undefined {
    const integration = this.integrations.get(id)
    if (!integration) return undefined
    if (integration.organizationId !== context.organizationId) return undefined
    if (integration.workspaceId !== context.workspaceId) return undefined
    return integration
  }

  listScoped(context: V2ScopeContext): Integration[] {
    return [...this.integrations.values()].filter(
      (integration) =>
        integration.organizationId === context.organizationId &&
        integration.workspaceId === context.workspaceId,
    )
  }

  setStatus(id: UUID, status: IntegrationStatus, updatedAt: string): Integration {
    const integration = this.integrations.get(id)
    if (!integration) throw new Error('V2 integration does not exist.')
    const updated = { ...integration, status, updatedAt }
    this.integrations.set(id, updated)
    return updated
  }

  capabilities(id: UUID, context: V2ScopeContext): string[] {
    const integration = this.getScoped(id, context)
    if (!integration || integration.status !== 'active') return []
    return [...integration.capabilities]
  }
}

export function prepareIntegrationOperation(
  store: V2ControlPlaneStore,
  registry: IntegrationRegistry,
  request: IntegrationOperationRequest,
): PreparedIntegrationOperation {
  const integration = registry.getScoped(request.integrationId, request.context)

  if (!integration) throw new Error('V2 integration is outside the active scope.')
  if (integration.status !== 'active') throw new Error('V2 integration is not active.')
  if (!integration.capabilities.includes(request.capability)) {
    throw new Error('V2 integration capability is not registered.')
  }

  const governance = govern(store, {
    userId: request.userId,
    permission: request.permission,
    context: request.context,
    resource: {
      organizationId: integration.organizationId,
      workspaceId: integration.workspaceId,
      resourceType: 'integration',
      action: request.action,
      resourceId: integration.id,
    },
    requestedAutonomy: request.requestedAutonomy,
    requiresApproval: request.requiresApproval,
    approvalId: request.approvalId,
    attributes: request.attributes,
  })

  if (!governance.allowed) {
    throw new Error('V2 integration operation is not governed for execution.')
  }

  return {
    integration,
    capability: request.capability,
    action: request.action,
    input: request.input,
    governance,
  }
}
