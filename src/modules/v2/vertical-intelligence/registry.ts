import type { VerticalId, VerticalIntelligenceDefinition } from './types'

const definitions = new Map<VerticalId, VerticalIntelligenceDefinition>()

export function registerVerticalIntelligence(definition: VerticalIntelligenceDefinition): void {
  if (definitions.has(definition.id)) {
    throw new Error(`Vertical intelligence already registered: ${definition.id}`)
  }
  definitions.set(definition.id, definition)
}

export function getVerticalIntelligence(id: VerticalId): VerticalIntelligenceDefinition | undefined {
  return definitions.get(id)
}

export function listVerticalIntelligence(): VerticalIntelligenceDefinition[] {
  return Array.from(definitions.values())
}
