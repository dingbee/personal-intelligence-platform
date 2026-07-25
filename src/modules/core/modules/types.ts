import type { AICapability } from '@/modules/core/capabilities/types'
import type { PromptTemplate } from '@/modules/core/prompts/types'
import type { AIProviderDescriptor } from '@/modules/core/providers/types'
import type { Workflow } from '@/modules/core/workflows/types'

/**
 * A domain module (Education, Writing, Research, News, Business, ...)
 * declares what it contributes here. registerPlatformModule() pushes each
 * array into the matching registry — the core app never imports a domain
 * module directly or branches on its presence.
 */
export interface PlatformModule {
  id: string
  name: string
  capabilities?: AICapability[]
  prompts?: PromptTemplate[]
  providers?: AIProviderDescriptor[]
  workflows?: Workflow[]
}
