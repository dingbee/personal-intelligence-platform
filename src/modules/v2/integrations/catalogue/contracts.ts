/**
 * IFAB-01: versioned contracts for the enterprise integration catalogue.
 *
 * These descriptors define what a provider/capability means. They do not
 * store credentials, fetch external data, authorize users, or execute work.
 * NoVA Core remains the transport and execution authority.
 */

export type IntegrationProtocol = 'api' | 'webhook' | 'mcp'
export type CapabilityAccessMode = 'read' | 'write'
export type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'
export type JsonPrimitive = string | number | boolean | null

/** Deliberately bounded JSON Schema subset; unsupported keywords fail closed. */
export interface CapabilityJsonSchema {
  type: JsonSchemaType
  title?: string
  description?: string
  enum?: readonly JsonPrimitive[]
  properties?: Readonly<Record<string, CapabilityJsonSchema>>
  required?: readonly string[]
  additionalProperties?: boolean
  items?: CapabilityJsonSchema
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  minItems?: number
  maxItems?: number
}

export interface IntegrationCapabilityDescriptor {
  /** Stable capability key, e.g. invoices.read. */
  id: string
  /** Semantic version of this capability contract. */
  version: string
  displayName: string
  description?: string
  accessMode: CapabilityAccessMode
  /** Existing ARRIYIA permission key; enforced by the governance boundary. */
  permission: string
  /** Provider operations this capability is allowed to represent. */
  actions: readonly string[]
  requiresApproval: boolean
  inputSchema: CapabilityJsonSchema
  outputSchema: CapabilityJsonSchema
}

export interface IntegrationProviderDescriptor {
  /** Stable provider key, e.g. google-workspace or generic-rest. */
  providerId: string
  /** Semantic version of this complete provider descriptor. */
  version: string
  displayName: string
  description?: string
  protocols: readonly IntegrationProtocol[]
  capabilities: readonly IntegrationCapabilityDescriptor[]
}

export interface ContractIssue {
  path: string
  code: string
  message: string
}

export interface ContractValidation {
  valid: boolean
  issues: ContractIssue[]
}

export interface CapabilityValidationOptions {
  /** Maximum nesting depth for schema/value traversal. */
  maxDepth?: number
}
