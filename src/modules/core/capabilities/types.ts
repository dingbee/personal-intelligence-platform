/**
 * A named AI operation (Summarize, Quiz, Translate, ...) that a domain
 * module can contribute. Deliberately has no `run`/execution field yet —
 * there's no AI provider wired up until Milestone 4, and adding a fake
 * executor now would just be scaffolding with nothing behind it. Once a
 * real provider exists, execution will resolve a capability to a
 * PromptTemplate and a provider, not to file-type-specific branching.
 */
export interface AICapability {
  id: string
  label: string
  description: string
  /** Which module contributed this — stamped by registerPlatformModule, not set by hand. */
  moduleId?: string
}
