import type { AiMemory } from '@/shared/types/database'

/**
 * UX-13.6 Phase 2 — Memory & Personalization redesign. Every structured
 * profile field (occupation, industry, expertise, ...) is still just an
 * `ai_memory` row with `memory_type: 'explicit_profile'` — no schema
 * change, no new table. What's new is the `source` naming convention
 * ("profile:<field>") that lets the UI read a specific field back out of
 * the same free-text rows retrieveMemoryContext/formatMemoriesForPrompt
 * already feed into chat unchanged. A single-select field (occupation,
 * industry, communication style, answer length, decision style) is at
 * most one row per source; a multi-select field (expertise, goals) is
 * one row per selected value, all sharing the same source.
 */
export type ProfileFieldKey =
  | 'occupation'
  | 'industry'
  | 'expertise'
  | 'goals'
  | 'communication_style'
  | 'answer_length'
  | 'decision_style'

const PROFILE_SOURCE_PREFIX = 'profile:'

export function profileSource(field: ProfileFieldKey): string {
  return `${PROFILE_SOURCE_PREFIX}${field}`
}

export function isProfileMemory(memory: Pick<AiMemory, 'source'>): boolean {
  return memory.source !== null && memory.source.startsWith(PROFILE_SOURCE_PREFIX)
}

export function profileFieldOf(memory: Pick<AiMemory, 'source'>): ProfileFieldKey | null {
  if (!memory.source || !memory.source.startsWith(PROFILE_SOURCE_PREFIX)) return null
  const field = memory.source.slice(PROFILE_SOURCE_PREFIX.length)
  return SINGLE_SELECT_FIELDS.includes(field as ProfileFieldKey) || MULTI_SELECT_FIELDS.includes(field as ProfileFieldKey)
    ? (field as ProfileFieldKey)
    : null
}

export const SINGLE_SELECT_FIELDS: ProfileFieldKey[] = ['occupation', 'industry', 'communication_style', 'answer_length', 'decision_style']
export const MULTI_SELECT_FIELDS: ProfileFieldKey[] = ['expertise', 'goals']

/** The single row for a single-select field, or null if unset. Callers should never see more than one — writers (useProfileFields) enforce that invariant by updating/deleting the existing row instead of inserting a second. */
export function getSingleProfileValue(memories: AiMemory[], field: ProfileFieldKey): AiMemory | null {
  return memories.find((m) => m.source === profileSource(field)) ?? null
}

/** Every row for a multi-select field, in whatever order listMemories returned them (most-recently-updated first). */
export function getMultiProfileValues(memories: AiMemory[], field: ProfileFieldKey): AiMemory[] {
  return memories.filter((m) => m.source === profileSource(field))
}

export const OCCUPATION_OPTIONS = ['Business Owner', 'Executive', 'Manager', 'Freelancer', 'Consultant', 'Employee', 'Student', 'Researcher']
export const INDUSTRY_OPTIONS = ['Hospitality', 'Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Marketing', 'Real Estate', 'Manufacturing']
export const EXPERTISE_OPTIONS = ['Marketing', 'Branding', 'Finance', 'AI', 'Interior Design', 'Sales', 'Operations', 'Product', 'Design', 'Engineering', 'Writing', 'Strategy']
export const GOAL_OPTIONS = ['Grow business', 'Learn faster', 'Build knowledge', 'Improve productivity', 'Save time', 'Make better decisions', 'Organize information']
export const COMMUNICATION_STYLE_OPTIONS = ['Professional', 'Casual', 'Direct', 'Friendly', 'Technical', 'Concise']
export const DECISION_STYLE_OPTIONS = ['Analytical', 'Intuitive', 'Collaborative', 'Decisive', 'Cautious']

export type AnswerLength = 'brief' | 'balanced' | 'detailed'
export const ANSWER_LENGTH_LABELS: Record<AnswerLength, string> = { brief: 'Brief', balanced: 'Balanced', detailed: 'Detailed' }
