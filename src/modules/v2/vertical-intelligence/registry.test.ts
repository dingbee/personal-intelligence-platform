import { afterEach, describe, expect, it } from 'vitest'
import {
  clearVerticalContracts,
  getVerticalContract,
  listVerticalContracts,
  registerVerticalContract,
} from './registry'
import type { VerticalRegistration } from './types'

const contract: VerticalRegistration = {
  verticalId: 'synthetic-vertical',
  displayName: 'Synthetic Vertical',
  contractVersion: '1.0',
  capabilities: ['intelligence'],
  entities: [],
  signals: [],
  tools: [],
  agents: [],
  governanceRequirements: { approvalForConsequentialActions: true },
  executionAuthority: 'nova-core',
}

describe('V2 external vertical contract registry', () => {
  afterEach(() => clearVerticalContracts())

  it('starts empty and accepts a generic external contract', () => {
    expect(listVerticalContracts()).toEqual([])

    registerVerticalContract(contract)

    expect(getVerticalContract('synthetic-vertical')).toEqual(contract)
    expect(listVerticalContracts()).toEqual([contract])
  })

  it('rejects duplicate vertical contracts', () => {
    registerVerticalContract(contract)

    expect(() => registerVerticalContract(contract)).toThrow(
      'Vertical contract already registered: synthetic-vertical',
    )
  })

  it('rejects a contract that attempts to move execution authority away from NoVA Core', () => {
    const invalid = {
      ...contract,
      executionAuthority: 'arriyia' as 'nova-core',
    }

    expect(() => registerVerticalContract(invalid)).toThrow(
      'Invalid execution authority: synthetic-vertical',
    )
  })

  it('rejects a contract that removes approval governance for consequential actions', () => {
    const invalid = {
      ...contract,
      governanceRequirements: {
        approvalForConsequentialActions: false as true,
      },
    }

    expect(() => registerVerticalContract(invalid)).toThrow(
      'Consequential actions must remain approval-gated: synthetic-vertical',
    )
  })
})
