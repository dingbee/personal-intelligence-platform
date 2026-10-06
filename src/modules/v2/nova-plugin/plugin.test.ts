import { describe, expect, it } from 'vitest'
import { ARRIYIA_NOVA_PLUGIN_MANIFEST, getArriyiaNoVAPluginManifest } from './manifest'
import { NoVAPluginApiClient } from './client'

describe('ARRIYIA NoVA plugin contract', () => {
  it('declares ARRIYIA as a plugin rather than a Core subsystem', () => {
    expect(ARRIYIA_NOVA_PLUGIN_MANIFEST.id).toBe('arriyia')
    expect(ARRIYIA_NOVA_PLUGIN_MANIFEST.apiVersion).toBe('1.0')
    expect(ARRIYIA_NOVA_PLUGIN_MANIFEST.metadata).toMatchObject({
      integration: 'nova-core',
      executionAuthority: 'nova-core',
      executionTransport: 'api-webhook',
    })
    expect(ARRIYIA_NOVA_PLUGIN_MANIFEST.capabilities?.map((item) => item.id)).toEqual([
      'arriyia.personal-intelligence',
      'arriyia.agent-management',
      'arriyia.workflow-management',
      'arriyia.enterprise-intelligence',
    ])
  })

  it('returns a detached manifest copy for transport', () => {
    const copy = getArriyiaNoVAPluginManifest()
    expect(copy).toEqual(ARRIYIA_NOVA_PLUGIN_MANIFEST)
    expect(copy).not.toBe(ARRIYIA_NOVA_PLUGIN_MANIFEST)
    expect(copy.capabilities).not.toBe(ARRIYIA_NOVA_PLUGIN_MANIFEST.capabilities)
  })

  it('serializes plugin registration through the transport boundary', async () => {
    let captured: { input: RequestInfo | URL; init?: RequestInit } | undefined
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { input, init }
      return new Response(null, { status: 204 })
    }
    const client = new NoVAPluginApiClient('https://nova.example/', fetchImpl)

    await client.registerManifest(copyManifest())

    expect(captured).toBeDefined()
    expect(String(captured?.input)).toBe('https://nova.example/v1/plugins/manifests')
    expect(captured?.init?.method).toBe('POST')
    expect(captured?.init?.headers).toEqual({ 'content-type': 'application/json' })
  })

  it('fails closed on a non-success NoVA response', async () => {
    const fetchImpl: typeof fetch = async () => new Response(null, { status: 403 })
    const client = new NoVAPluginApiClient('https://nova.example/', fetchImpl)

    await expect(client.registerManifest(copyManifest())).rejects.toThrow(
      'NoVA Core API request failed with HTTP 403',
    )
  })
})

function copyManifest() {
  return getArriyiaNoVAPluginManifest()
}
