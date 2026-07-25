/**
 * A versioned prompt template tied to a capability. `id` includes the
 * version (e.g. 'rag-chat@1.0') since the registry is keyed by id and
 * multiple versions of the same capability's prompt can coexist — that's
 * what makes later A/B testing ("rag-chat@1.0 vs rag-chat@1.1") possible
 * without a separate versioning system bolted on afterward.
 */
export interface PromptTemplate {
  id: string
  capabilityId: string
  version: string
  template: string
  /** Which version is currently used when multiple exist for the same capability. */
  active?: boolean
  moduleId?: string
}
