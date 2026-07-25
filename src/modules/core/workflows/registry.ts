import { createRegistry } from '@/modules/core/registry'
import type { Workflow } from '@/modules/core/workflows/types'

export const workflowRegistry = createRegistry<Workflow>()
