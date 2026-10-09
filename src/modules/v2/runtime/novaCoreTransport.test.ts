import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}))

import { invokeNovaCore, NOVA_CORE_GATEWAY_FUNCTION } from './novaCoreTransport'

describe('NoVA Core transport boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the single ARRIYIA Supabase gateway function', () => {
    expect(NOVA_CORE_GATEWAY_FUNCTION).toBe('nova-core-gateway')
  })

  it('keeps the Core gateway secret outside the browser transport contract', () => {
    expect(NOVA_CORE_GATEWAY_FUNCTION).not.toContain('secret')
    expect(NOVA_CORE_GATEWAY_FUNCTION).not.toContain('token')
  })

  it('fails closed when workspace scope is missing before making a network request', async () => {
    await expect(invokeNovaCore({ action: 'agent.run', workspaceId: '' })).rejects.toThrow(
      'NoVA Core requests require an ARRIYIA Business Space.',
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('forwards the action and workspace scope through the gateway function', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true, accepted: true }, error: null })

    await expect(invokeNovaCore({
      action: 'agent.run',
      workspaceId: 'workspace-1',
      agentId: 'agent-1',
      correlationId: 'correlation-1',
    })).resolves.toEqual({ ok: true, accepted: true })

    expect(invokeMock).toHaveBeenCalledWith(NOVA_CORE_GATEWAY_FUNCTION, {
      body: {
        action: 'agent.run',
        workspaceId: 'workspace-1',
        agentId: 'agent-1',
        correlationId: 'correlation-1',
      },
    })
  })

  it('surfaces a safe gateway error message returned by the Edge Function', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ message: 'NoVA Core gateway configuration is missing.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    })

    await expect(invokeNovaCore({
      action: 'agent.run',
      workspaceId: 'workspace-1',
    })).rejects.toThrow('NoVA Core gateway configuration is missing.')
  })

  it('rejects a non-object gateway response', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: null })

    await expect(invokeNovaCore({
      action: 'agent.run',
      workspaceId: 'workspace-1',
    })).rejects.toThrow('NoVA Core returned an invalid gateway response.')
  })
})
