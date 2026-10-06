import { describe, expect, it } from 'vitest'
import { normalizeAgentDefinition } from './agentManagement'

describe('V2 agent management contract', () => {
  it('normalizes a complete definition without changing declared values', () => {
    const definition = normalizeAgentDefinition({
      version: 3,
      systemPurpose: 'Revenue analyst',
      capabilities: ['research', 'analysis', 7],
      toolIds: ['search'],
      memoryScopes: ['workspace'],
      policyIds: ['approval-required'],
      autonomyCeiling: 'bounded',
    })

    expect(definition).toEqual({
      version: 3,
      systemPurpose: 'Revenue analyst',
      capabilities: ['research', 'analysis'],
      toolIds: ['search'],
      memoryScopes: ['workspace'],
      policyIds: ['approval-required'],
      autonomy: 'bounded',
    })
  })

  it('fails closed to safe defaults for malformed definition data', () => {
    expect(normalizeAgentDefinition(null)).toEqual({
      version: 1,
      systemPurpose: '',
      capabilities: [],
      toolIds: [],
      memoryScopes: [],
      policyIds: [],
      autonomyCeiling: 'recommend',
    })
  })

  it('does not invent delegated autonomy from unknown input', () => {
    expect(normalizeAgentDefinition({
      version: 1,
      autonomyCeiling: 'unbounded',
    }).autonomyCeiling).toBe('recommend')
  })
})
