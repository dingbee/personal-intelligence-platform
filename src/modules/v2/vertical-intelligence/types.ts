import type { AutonomyLevel } from '../domain/autonomy'

/**
 * Generic vertical identity. ARRIYIA does not compile product names into its
 * control-plane type system.
 */
export type VerticalId = string

export type VerticalIntelligenceKind =
  | 'guest'
  | 'operations'
  | 'revenue'
  | 'inventory'
  | 'procurement'
  | 'sales'
  | 'executive'
  | 'custom'

export interface VerticalEntityDefinition {
  id: string
  label: string
  description: string
}

export interface VerticalSignalDefinition {
  id: string
  label: string
  description: string
  entityIds?: string[]
}

/** Declarative metadata only. No executable implementation is carried here. */
export interface VerticalToolDefinition {
  id: string
  description?: string
  requiresApproval: boolean
}

export interface VerticalAgentContextDefinition {
  entityIds: string[]
  signalIds: string[]
}

export interface VerticalAgentDefinition {
  id: string
  name: string
  description: string
  intelligenceKind: VerticalIntelligenceKind
  capabilities: string[]
  allowedTools: string[]
  context: VerticalAgentContextDefinition
  /** Declarative ceiling; approval remains a separate governance gate. */
  autonomy: AutonomyLevel
}

/**
 * Generic registration contract consumed by ARRIYIA's control plane.
 *
 * A vertical product owns the intelligence implementation and publishes this
 * contract. ARRIYIA owns governance, authorization and delegation only.
 */
export interface VerticalRegistration {
  verticalId: VerticalId
  displayName: string
  contractVersion: string
  capabilities: string[]
  entities: VerticalEntityDefinition[]
  signals: VerticalSignalDefinition[]
  tools: VerticalToolDefinition[]
  agents: VerticalAgentDefinition[]
  governanceRequirements: {
    approvalForConsequentialActions: true
  }
  executionAuthority: 'nova-core'
}

/** @deprecated Prefer VerticalRegistration. Kept as a compatibility alias for contract consumers. */
export type VerticalIntelligenceDefinition = VerticalRegistration
