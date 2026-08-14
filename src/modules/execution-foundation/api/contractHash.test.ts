import { describe, expect, it } from 'vitest'
import { computeContractHash, serializeContract } from '@/modules/execution-foundation/api/contractHash'
import type { ExecutionContract } from '@/modules/execution-foundation/execution'

function baseContract(overrides: Partial<ExecutionContract> = {}): ExecutionContract {
  return {
    capability: 'create_note',
    target: { noteTitle: 'My Note' },
    inputPayload: { content: 'hello' },
    expectedEffect: 'A note is created',
    riskClassification: 'low',
    externalSideEffects: false,
    ...overrides,
  }
}

describe('serializeContract', () => {
  it('is stable regardless of object key insertion order', () => {
    const a = serializeContract(baseContract({ target: { a: 1, b: 2 } }))
    const b = serializeContract(baseContract({ target: { b: 2, a: 1 } }))
    expect(a).toBe(b)
  })
})

describe('computeContractHash', () => {
  it('produces the same hash for two logically identical contracts', async () => {
    const h1 = await computeContractHash(baseContract())
    const h2 = await computeContractHash(baseContract())
    expect(h1).toBe(h2)
  })

  it('produces a different hash when the capability changes', async () => {
    const h1 = await computeContractHash(baseContract())
    const h2 = await computeContractHash(baseContract({ capability: 'send_message' }))
    expect(h1).not.toBe(h2)
  })

  it('produces a different hash when the target changes', async () => {
    const h1 = await computeContractHash(baseContract())
    const h2 = await computeContractHash(baseContract({ target: { noteTitle: 'A Different Note' } }))
    expect(h1).not.toBe(h2)
  })

  it('produces a different hash when the input payload changes', async () => {
    const h1 = await computeContractHash(baseContract())
    const h2 = await computeContractHash(baseContract({ inputPayload: { content: 'goodbye' } }))
    expect(h1).not.toBe(h2)
  })

  it('produces a different hash when risk classification changes', async () => {
    const h1 = await computeContractHash(baseContract())
    const h2 = await computeContractHash(baseContract({ riskClassification: 'high' }))
    expect(h1).not.toBe(h2)
  })

  it('produces a different hash when externalSideEffects changes', async () => {
    const h1 = await computeContractHash(baseContract())
    const h2 = await computeContractHash(baseContract({ externalSideEffects: true }))
    expect(h1).not.toBe(h2)
  })

  it('is a 64-character lowercase hex string (SHA-256)', async () => {
    const hash = await computeContractHash(baseContract())
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
