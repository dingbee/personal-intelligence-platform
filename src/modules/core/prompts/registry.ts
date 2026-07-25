import { createRegistry } from '@/modules/core/registry'
import type { PromptTemplate } from '@/modules/core/prompts/types'

export const promptRegistry = createRegistry<PromptTemplate>()
