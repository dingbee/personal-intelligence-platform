import type { AutonomyLevel } from '../domain/autonomy'

export type VerticalId = 'staynas' | 'lexibite'

export type VerticalIntelligenceKind =
  | 'guest'
  | 'operations'
  | 'revenue'
  | 'inventory'
  | 'procurement'
  | 'sales'
  | 'executive'

export interface VerticalEntityDefinition {
  id: string
  label: string
  description: string
}

export interface VerticalSignalDefinition {
  id: string
  label: string
  description: string
  entityIds?: string[]
}

export interface VerticalAgentDefinition {
  id: string
  name: string
  description: string
  intelligenceKind: VerticalIntelligenceKind
  capabilities: string[]
  allowedTools: string[]
  /** Declarative ceiling; approval remains a separate governance gate. */
  autonomy: AutonomyLevel
}

export interface VerticalIntelligenceDefinition {
  id: VerticalId
  name: string
  description: string
  entities: VerticalEntityDefinition[]
  signals: VerticalSignalDefinition[]
  agents: VerticalAgentDefinition[]
}
