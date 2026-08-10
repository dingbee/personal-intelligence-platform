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
  /**
   * Phase P0 Pro Intelligence Foundation — an optional plan-entitlement
   * feature key (the same key has_feature/hasFeature resolve, e.g.
   * 'pro_intelligence') a future module can declare so runCapability
   * denies execution before resolving a prompt/provider for a user who
   * isn't entitled. This is the same UX-hint-only client check used
   * everywhere else in the app (see useHasFeature's doc comment) — a
   * capability whose execution persists something privileged must still
   * enforce entitlement server-side in its own RPC, the same way
   * invite_to_workspace re-checks 'collaboration'. Omitted (every
   * capability registered today) means unrestricted, so existing
   * capabilities are unaffected.
   */
  requiredFeature?: string
}
