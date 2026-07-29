export type LearningStage = 'starting' | 'in_progress' | 'reviewing' | 'practicing' | 'mastered'
export type KnowledgeLevel = 'novice' | 'developing' | 'proficient'

export interface LearningIntelligence {
  stage: LearningStage
  knowledgeLevel: KnowledgeLevel
  suggestedNextStep: string
  reviewOpportunity: boolean
  practiceOpportunity: boolean
}
