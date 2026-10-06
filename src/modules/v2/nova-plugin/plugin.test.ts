import { describe, expect, it } from 'vitest'
import { ARRIYIA_NOVA_PLUGIN_MANIFEST, getArriyiaNoVAPluginManifest } from './manifest'
import { NoVAPluginApiClient } from './client'

describe('ARRIYIA NoVA plugin gateway contract', () => {
  it('declares ARRIYIA as a plugin rather than a Core subsystem', () => {
    expect(ARRIYIA_NOVA_PLUGIN_MANIFEST.id).toBe('arriyia')
    expect(ARRIYIA_NOVA_PLUGIN_MANIFEST.apiVersion).toBe('1.0')
    expect(ARRIYIA_NOVA_PLUGIN_MANIFEST.metadata).toMatchObject({
      integration: 'nova-core',
      executionAuthority: 'nova-core',
      executionTransport: 'api-webhook',
    })
  })

  it('returns a detached manifest copy for transport', () => {
    const copy = getArriyiaNoVAPluginManifest()
    expect(copy).toEqual(ARRIYIA_NOVA_PLUGIN_MANIFEST)
    expect(copy).not.toBe(ARRIYIA_NOVA_PLUGIN_MANIFEST)
    expect(copy.capabilities).not.toBe(ARRIYIA_NOVA_PLUGIN_MANIFEST.capabilities)
  })

  it('uses the actual P0-4 gateway route and required headers for registration', async () => {
    let captured: { input: RequestInfo | URL; init?: RequestInit } | undefined
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { input, init }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    const client = new NoVAPluginApiClient(
      'https://nova.example/',
      'arriyia',
      {
        getHeaders: (organizationId, pluginId) => ({
          authorization: 'Bearer test-secret',
          'x-nova-organization-id': organizationId,
          'x-nova-plugin-id': pluginId,
        }),
      },
      fetchImpl,
    )

    await client.registerManifest(getArriyiaNoVAPluginManifest(), '11111111-1111-4111-8111-111111111111')

    expect(String(captured?.input)).toBe('https://nova.example/api/public/core/plugin-gateway')
    expect(captured?.init?.method).toBe('POST')
    expect(captured?.init?.headers).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer test-secret',
      'x-nova-organization-id': '11111111-1111-4111-8111-111111111111',
      'x-nova-plugin-id': 'arriyia',
    })
    expect(JSON.parse(String(captured?.init?.body))).toMatchObject({
      action: 'register',
      manifest: ARRIYIA_NOVA_PLUGIN_MANIFEST,
    })
  })

  it('maps an acknowledged agent response to accepted rather than falsely claiming success', async () => {
    const client = new NoVAPluginApiClient(
      'https://nova.example/',
      'arriyia',
      { getHeaders: () => ({ authorization: 'Bearer test', 'x-nova-organization-id': '11111111-1111-4111-8111-111111111111', 'x-nova-plugin-id': 'arriyia' }) },
      async () => new Response(JSON.stringify({
        runId: 'agent-run-1',
        status: 'completed',
        output: 'should not be treated as an ARRIYIA success outcome',
      }), { status: 200 }),
    )

    const reference = await client.startAgent({
      contractVersion: '1.0.0',
      organizationId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      correlationId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'idem-agent-1',
      agentId: 'agent-1',
      input: { userInput: 'hello' },
    })

    expect(reference.runId).toBe('agent-run-1')
    expect(reference.state).toBe('accepted')
    expect(reference).not.toHaveProperty('output')
  })

  it('maps a runtime lookup to a terminal result and preserves unknown state', async () => {
    const terminal = new NoVAPluginApiClient(
      'https://nova.example/',
      'arriyia',
      { getHeaders: () => ({ authorization: 'Bearer test', 'x-nova-organization-id': '11111111-1111-4111-8111-111111111111', 'x-nova-plugin-id': 'arriyia' }) },
      async () => new Response(JSON.stringify({
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'completed',
        finished_at: '2026-10-06T15:00:00.000Z',
      }), { status: 200 }),
    )

    await expect(terminal.getRun('run-1', {
      contractVersion: '1.0.0',
      organizationId: '11111111-1111-4111-8111-111111111111',
      correlationId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'idem-read-1',
    })).rejects.toThrow('did not contain a runId.')
  })

  it('returns unknown rather than fabricating execution success for an unrecognized runtime state', async () => {
    const client = new NoVAPluginApiClient(
      'https://nova.example/',
      'arriyia',
      { getHeaders: () => ({ authorization: 'Bearer test', 'x-nova-organization-id': '11111111-1111-4111-8111-111111111111', 'x-nova-plugin-id': 'arriyia' }) },
      async () => new Response(JSON.stringify({
        id: 'run-1',
        runId: 'run-1',
        status: 'future_state',
      }), { status: 200 }),
    )

    const result = await client.getRun('run-1', {
      contractVersion: '1.0.0',
      organizationId: '11111111-1111-4111-8111-111111111111',
      correlationId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'idem-read-2',
    })

    expect(result).toMatchObject({ runId: 'run-1', state: 'unknown' })
  })

  it('treats a missing NoVA run as unresolved rather than as failure', async () => {
    const client = new NoVAPluginApiClient(
      'https://nova.example/',
      'arriyia',
      { getHeaders: () => ({ authorization: 'Bearer test', 'x-nova-organization-id': '11111111-1111-4111-8111-111111111111', 'x-nova-plugin-id': 'arriyia' }) },
      async () => new Response(JSON.stringify({ error: 'RUN_NOT_FOUND' }), { status: 404 }),
    )

    await expect(client.getRun('missing-run', {
      contractVersion: '1.0.0',
      organizationId: '11111111-1111-4111-8111-111111111111',
      correlationId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'idem-read-3',
    })).resolves.toBeUndefined()
  })

  it('fails closed on a non-success gateway response', async () => {
    const client = new NoVAPluginApiClient(
      'https://nova.example/',
      'arriyia',
      { getHeaders: () => ({ authorization: 'Bearer test', 'x-nova-organization-id': '11111111-1111-4111-8111-111111111111', 'x-nova-plugin-id': 'arriyia' }) },
      async () => new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }),
    )

    await expect(client.registerManifest(getArriyiaNoVAPluginManifest(), '11111111-1111-4111-8111-111111111111')).rejects.toThrow(
      'HTTP 401',
    )
  })
})
