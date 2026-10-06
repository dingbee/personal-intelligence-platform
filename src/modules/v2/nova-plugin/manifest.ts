import type { PluginManifest } from './types'

/**
 * Canonical ARRIYIA plugin identity for NoVA Core.
 *
 * ARRIYIA is a consumer plugin, not a Core-owned module. This manifest is
 * declarative compatibility metadata only; NoVA Core remains responsible for
 * installation, lifecycle, entitlement and execution.
 */
export const ARRIYIA_NOVA_PLUGIN_MANIFEST: PluginManifest = {
  id: 'arriyia',
  name: 'ARRIYIA',
  description: 'Personal Intelligence plugin for NoVA Core.',
  version: '2.0.0',
  apiVersion: '1.0',
  minCoreVersion: '1.0.0',
  dependencies: [],
  capabilities: [
    {
      id: 'arriyia.personal-intelligence',
      version: '1.0.0',
      description: 'Personal intelligence workspace and context capabilities.',
    },
    {
      id: 'arriyia.agent-management',
      version: '1.0.0',
      description: 'Declarative agent management and governance surfaces.',
    },
    {
      id: 'arriyia.workflow-management',
      version: '1.0.0',
      description: 'Declarative workflow design and governance surfaces.',
    },
    {
      id: 'arriyia.enterprise-intelligence',
      version: '1.0.0',
      description: 'Enterprise ARRIYIA capabilities entitled through the plugin boundary.',
    },
  ],
  permissions: [
    {
      id: 'plugin.read',
      description: 'Read ARRIYIA plugin state exposed by NoVA Core.',
    },
  ],
  metadata: {
    product: 'arriyia',
    integration: 'nova-core',
    executionAuthority: 'nova-core',
    executionTransport: 'api-webhook',
  },
}

export function getArriyiaNoVAPluginManifest(): PluginManifest {
  return {
    ...ARRIYIA_NOVA_PLUGIN_MANIFEST,
    dependencies: [...(ARRIYIA_NOVA_PLUGIN_MANIFEST.dependencies ?? [])],
    capabilities: [...(ARRIYIA_NOVA_PLUGIN_MANIFEST.capabilities ?? [])],
    permissions: [...(ARRIYIA_NOVA_PLUGIN_MANIFEST.permissions ?? [])],
    metadata: { ...(ARRIYIA_NOVA_PLUGIN_MANIFEST.metadata ?? {}) },
  }
}
