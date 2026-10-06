export interface PluginDependencyContract {
  pluginId: string
  versionRange: string
  optional?: boolean
}

export interface PluginCapabilityContract {
  id: string
  version: string
  description: string
  conflictsWith?: string[]
  requires?: string[]
}

export interface PluginPermissionContract {
  id: string
  description: string
}

export interface PluginManifest {
  id: string
  name: string
  description?: string
  version: string
  apiVersion: string
  minCoreVersion: string
  dependencies?: PluginDependencyContract[]
  capabilities?: PluginCapabilityContract[]
  permissions?: PluginPermissionContract[]
  metadata?: Record<string, string | number | boolean>
}

/**
 * Local type mirror of NoVA Core's PluginManifest contract.
 * ARRIYIA never registers itself into a local registry; NoVA Core is the
 * authoritative plugin registry and entitlement authority.
 */
