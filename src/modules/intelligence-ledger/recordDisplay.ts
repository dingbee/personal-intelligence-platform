import type { IntelligenceRecordStatus, IntelligenceRecordType } from '@/shared/types/database'

/**
 * The single source of truth for how a record type/status is labeled and
 * colored across History (HistoryPage, IntelligenceRecordCard,
 * IntelligenceRecordDetailPage, IntelligenceJourneyDetailPage) — mirrors
 * ActionsPage.tsx's own TYPE_LABEL/READINESS_BADGE convention rather than
 * inventing a new one.
 */
export const RECORD_TYPE_LABEL: Record<IntelligenceRecordType, string> = {
  data: 'Data',
  analysis: 'Analysis',
  research: 'Research',
  planning: 'Planning',
  decision: 'Decision',
  action: 'Action',
  execution: 'Execution',
}

export const RECORD_TYPES: IntelligenceRecordType[] = ['data', 'analysis', 'research', 'planning', 'decision', 'action', 'execution']

type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export const RECORD_STATUS_LABEL: Record<IntelligenceRecordStatus, string> = {
  created: 'Created',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  superseded: 'Superseded',
  archived: 'Archived',
}

export const RECORD_STATUS_VARIANT: Record<IntelligenceRecordStatus, StatusBadgeVariant> = {
  created: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'error',
  superseded: 'warning',
  archived: 'neutral',
}

export const RECORD_STATUSES: IntelligenceRecordStatus[] = ['created', 'running', 'completed', 'failed', 'superseded', 'archived']

/** camelCase/snake_case -> "Title Case" — the one humanization rule StructuredOutputView applies to every structured_output key. */
export function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
