import { createRegistry } from '@/modules/core/registry'
import type { PromptTemplate } from '@/modules/core/prompts/types'

export const promptRegistry = createRegistry<PromptTemplate>()

/** The version to use for a capability right now — the one marked `active`, or the newest by registration order. */
export function getActivePrompt(capabilityId: string): PromptTemplate | undefined {
  const versions = promptRegistry.list().filter((prompt) => prompt.capabilityId === capabilityId)
  return versions.find((prompt) => prompt.active) ?? versions.at(-1)
}
