import { describe, expect, it } from 'vitest'
import type { IntegrationCapabilityDescriptor, IntegrationProviderDescriptor } from './contracts'
import {
  compareContractVersions,
  resolveCapabilityDescriptor,
  resolveProviderDescriptor,
} from './registry'
import { validateCapabilityValue, validateIntegrationProviderDescriptor } from './validation'

const inputSchema = {
  type: 'object' as const,
  properties: {
    invoiceId: { type: 'string' as const, minLength: 1 },
    limit: { type: 'integer' as const, minimum: 1, maximum: 100 },
  },
  required: ['invoiceId'],
  additionalProperties: false,
}
const outputSchema = {
  type: 'object' as const,
  properties: { total: { type: 'number' as const, minimum: 0 } },
  required: ['total'],
  additionalProperties: false,
}

function capability(version = '1.0.0', overrides: Partial<IntegrationCapabilityDescriptor> = {}): IntegrationCapabilityDescriptor {
  return {
    id: 'invoices.read',
    version,
    displayName: 'Read invoices',
    accessMode: 'read',
    permission: 'integration.invoices.read',
    actions: ['list', 'get'],
    requiresApproval: false,
    inputSchema,
    outputSchema,
    ...overrides,
  }
}

function provider(version = '1.0.0', capabilities = [capability()]): IntegrationProviderDescriptor {
  return {
    providerId: 'generic-rest',
    version,
    displayName: 'Generic REST API',
    protocols: ['api'],
    capabilities,
  }
}

describe('IFAB-01 integration catalogue contracts', () => {
  it('validates versioned provider and capability descriptors', () => {
    expect(validateIntegrationProviderDescriptor(provider()).valid).toBe(true)
  })

  it('rejects malformed versions, duplicate capability versions and unsupported schema keywords', () => {
    const invalid = provider('v1', [
      capability('1.0.0', { inputSchema: { ...inputSchema, arbitrary: true } as typeof inputSchema }),
      capability('1.0.0'),
    ])
    const result = validateIntegrationProviderDescriptor(invalid)
    expect(result.valid).toBe(false)
    expect(result.issues.map((entry) => entry.code)).toContain('invalid_version')
    expect(result.issues.map((entry) => entry.code)).toContain('unsupported_schema_keyword')
    expect(result.issues.map((entry) => entry.code)).toContain('duplicate_capability_version')
  })

  it('resolves the highest semantic version deterministically and supports exact pinning', () => {
    const v1 = provider('1.0.0')
    const v2 = provider('2.0.0')
    expect(resolveProviderDescriptor([v2, v1], 'generic-rest')).toEqual({ found: true, value: v2 })
    expect(resolveProviderDescriptor([v2, v1], 'generic-rest', '1.0.0')).toEqual({ found: true, value: v1 })
    expect(resolveProviderDescriptor([v1, v2], 'missing').reason).toBe('not_found')
  })

  it('fails closed for duplicate provider versions instead of choosing by input order', () => {
    const result = resolveProviderDescriptor([provider(), provider()], 'generic-rest')
    expect(result).toEqual({ found: false, reason: 'ambiguous_version' })
  })

  it('resolves the newest capability contract and permits exact version pinning', () => {
    const source = provider('1.0.0', [capability('1.0.0'), capability('1.2.0')])
    expect(resolveCapabilityDescriptor(source, 'invoices.read')).toEqual({ found: true, value: source.capabilities[1] })
    expect(resolveCapabilityDescriptor(source, 'invoices.read', '1.0.0')).toEqual({ found: true, value: source.capabilities[0] })
  })

  it('validates capability inputs/outputs and rejects undeclared properties', () => {
    expect(validateCapabilityValue(inputSchema, { invoiceId: 'INV-1', limit: 20 }).valid).toBe(true)
    expect(validateCapabilityValue(inputSchema, { invoiceId: '', limit: 101 }).valid).toBe(false)
    expect(validateCapabilityValue(inputSchema, { invoiceId: 'INV-1', unexpected: true }).issues.map((entry) => entry.code)).toContain('additional_property_forbidden')
    expect(validateCapabilityValue(outputSchema, { total: -1 }).issues.map((entry) => entry.code)).toContain('number_too_small')
  })

  it('returns stable, path-sorted validation issues independent of object key order', () => {
    const schema = { type: 'object' as const, properties: { z: { type: 'string' as const }, a: { type: 'integer' as const } }, required: ['z', 'a'], additionalProperties: false }
    const first = validateCapabilityValue(schema, { unknown: 1, z: 2 })
    const second = validateCapabilityValue(schema, { z: 2, unknown: 1 })
    expect(first).toEqual(second)
    expect(first.issues.map((entry) => entry.path)).toEqual([...first.issues.map((entry) => entry.path)].sort())
  })

  it('orders stable semantic releases above prereleases', () => {
    expect(compareContractVersions('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0)
    expect(compareContractVersions('1.2.0', '1.10.0')).toBeLessThan(0)
  })
})
