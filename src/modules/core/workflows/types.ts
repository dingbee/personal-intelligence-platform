/**
 * A named sequence of capabilities a domain module can offer (e.g.
 * Education's "Lesson Plan" might chain Outline -> Quiz -> Flashcards).
 * Structural only for now — nothing executes workflows until there's an
 * AI engine to run capabilities against.
 */
export interface Workflow {
  id: string
  label: string
  description: string
  capabilityIds: string[]
  moduleId?: string
}
