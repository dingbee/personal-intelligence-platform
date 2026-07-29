import type { IntentType } from '@/modules/intelligence/intent/intentTypes'
import type { DocumentJourney } from '@/modules/reader/intelligence/documentJourney'
import type { KnowledgeLevel, LearningIntelligence, LearningStage } from '@/modules/intelligence/learning/learningTypes'
import { DEVELOPING_ACTIVITY_THRESHOLD, LEARNING_INTENTS, LOW_FLASHCARD_THRESHOLD, PROFICIENT_ACTIVITY_THRESHOLD } from '@/modules/intelligence/learning/learningRules'

export interface LearningEngineInput {
  intent: IntentType
  /** Reused wholesale from UX-9's computeDocumentJourney — never recomputed here. Null when there's no document context for this conversation. */
  journey: DocumentJourney | null
  unreviewedHighlightCount: number
}

const NEXT_STEP_BY_STAGE: Record<LearningStage, string> = {
  starting: 'Start reading to begin building knowledge on this topic.',
  in_progress: 'Continue reading where you left off.',
  reviewing: 'Review your highlights and summaries before moving on.',
  practicing: "Practice with your flashcards to reinforce what you've learned.",
  mastered: 'Explore related topics to deepen your expertise.',
}

function deriveStage(journey: DocumentJourney): LearningStage {
  if (journey.status === 'not_started') return 'starting'
  if (journey.status === 'paused') return 'reviewing'
  if (journey.status === 'completed') {
    const totalActivity = journey.summarizedChapterCount + journey.flashcardCount + journey.notesAddedCount + journey.questionsAskedCount
    return totalActivity >= PROFICIENT_ACTIVITY_THRESHOLD ? 'mastered' : 'practicing'
  }
  return 'in_progress'
}

function deriveKnowledgeLevel(journey: DocumentJourney): KnowledgeLevel {
  const totalActivity = journey.summarizedChapterCount + journey.flashcardCount + journey.notesAddedCount + journey.questionsAskedCount
  if (totalActivity >= PROFICIENT_ACTIVITY_THRESHOLD) return 'proficient'
  if (totalActivity >= DEVELOPING_ACTIVITY_THRESHOLD) return 'developing'
  return 'novice'
}

/**
 * UX-12 Phase 6 — Learning Intelligence. Reuses UX-9's Reader Intelligence
 * (computeDocumentJourney) as its entire evidence base — no new tracking,
 * no AI call. Returns null for a conversation that isn't learning-oriented
 * (see LEARNING_INTENTS) rather than forcing every message through a
 * learning lens.
 */
export function detectLearningIntelligence(input: LearningEngineInput): LearningIntelligence | null {
  if (!LEARNING_INTENTS.has(input.intent) || !input.journey) return null

  const stage = deriveStage(input.journey)
  const knowledgeLevel = deriveKnowledgeLevel(input.journey)

  return {
    stage,
    knowledgeLevel,
    suggestedNextStep: NEXT_STEP_BY_STAGE[stage],
    reviewOpportunity: input.unreviewedHighlightCount > 0,
    practiceOpportunity: (stage === 'in_progress' || stage === 'reviewing') && input.journey.flashcardCount < LOW_FLASHCARD_THRESHOLD,
  }
}
