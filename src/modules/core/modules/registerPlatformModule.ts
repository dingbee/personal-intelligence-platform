import type { PlatformModule } from '@/modules/core/modules/types'
import { capabilityRegistry } from '@/modules/core/capabilities/registry'
import { promptRegistry } from '@/modules/core/prompts/registry'
import { providerRegistry } from '@/modules/core/providers/registry'
import { workflowRegistry } from '@/modules/core/workflows/registry'

/** The one entry point domain modules use to extend the platform without touching core code. */
export function registerPlatformModule(module: PlatformModule): void {
  for (const capability of module.capabilities ?? []) {
    capabilityRegistry.register({ ...capability, moduleId: module.id })
  }
  for (const prompt of module.prompts ?? []) {
    promptRegistry.register({ ...prompt, moduleId: module.id })
  }
  for (const provider of module.providers ?? []) {
    providerRegistry.register({ ...provider, moduleId: module.id })
  }
  for (const workflow of module.workflows ?? []) {
    workflowRegistry.register({ ...workflow, moduleId: module.id })
  }
}
