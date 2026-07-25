/**
 * A prompt template tied to a capability. Kept as inert data for now — no
 * execution engine exists until Milestone 4 wires up a real provider, at
 * which point resolving a capability -> template -> provider replaces any
 * temptation to branch on document type or feature name in application code.
 */
export interface PromptTemplate {
  id: string
  capabilityId: string
  template: string
  moduleId?: string
}
