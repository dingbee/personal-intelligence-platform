import type { IntentType } from '@/modules/intelligence/intent/intentTypes'

/** Which intents count as "learning-oriented" for the purposes of this module — everything else returns null (not a learning conversation) rather than forcing a guess. */
export const LEARNING_INTENTS: ReadonlySet<IntentType> = new Set(['learn', 'teach', 'review'])

export const PROFICIENT_ACTIVITY_THRESHOLD = 10
export const DEVELOPING_ACTIVITY_THRESHOLD = 3
export const LOW_FLASHCARD_THRESHOLD = 5
