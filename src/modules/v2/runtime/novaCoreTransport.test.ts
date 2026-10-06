import { describe, expect, it } from 'vitest'
import { NOVA_CORE_GATEWAY_FUNCTION } from './novaCoreTransport'

describe('NoVA Core transport boundary', () => {
  it('uses the single ARRIYIA Supabase gateway function', () => {
    expect(NOVA_CORE_GATEWAY_FUNCTION).toBe('nova-core-gateway')
  })

  it('keeps the Core gateway secret outside the browser transport contract', () => {
    expect(NOVA_CORE_GATEWAY_FUNCTION).not.toContain('secret')
    expect(NOVA_CORE_GATEWAY_FUNCTION).not.toContain('token')
  })
})
