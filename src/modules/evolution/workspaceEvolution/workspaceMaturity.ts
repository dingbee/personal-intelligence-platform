import { daysSince, deriveTrendDirection } from '@/modules/evolution/shared/trend'

export type MaturityStage = 'growing' | 'active' | 'mature' | 'stagnant' | 'declining'

export interface WorkspaceMaturity {
  stage: MaturityStage
  label: string
  reason: string
}

export interface WorkspaceMaturityInput {
  workspaceCreatedAt: string
  /** Every workspace-scoped activity timestamp (documents/notes/concepts/connections/conversations created_at) — the same raw material dashboardMetrics.computeKnowledgeGrowth already counts, just windowed here instead. */
  activityTimestamps: string[]
  lastActivityAt: string | null
  now?: Date
}

const RECENT_WINDOW_DAYS = 7
const BASELINE_WINDOW_DAYS = 30
const MATURE_MIN_AGE_DAYS = 90
const DECLINING_INACTIVITY_DAYS = 60
const STAGNANT_INACTIVITY_DAYS = 30

/**
 * UX-13 — every workspace's activity classified into one of five stages,
 * purely from timestamps already produced elsewhere in the app (no new
 * event log, no ML). Growing/declining are trend-based (this week's
 * activity rate vs. the last 30 days' rate, the same comparison
 * dashboardMetrics.deriveTrend already makes); mature/stagnant fall back to
 * age and recency when the trend itself is flat.
 */
export function computeWorkspaceMaturity(input: WorkspaceMaturityInput): WorkspaceMaturity {
  const now = input.now ?? new Date()
  const ageDays = daysSince(input.workspaceCreatedAt, now)
  const recentCount = input.activityTimestamps.filter(
    (t) => now.getTime() - new Date(t).getTime() <= RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).length
  const baselineCount = input.activityTimestamps.filter(
    (t) => now.getTime() - new Date(t).getTime() <= BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).length
  const inactivityDays = input.lastActivityAt ? daysSince(input.lastActivityAt, now) : ageDays

  if (baselineCount === 0 || inactivityDays >= DECLINING_INACTIVITY_DAYS) {
    return {
      stage: 'declining',
      label: 'Declining',
      reason: input.lastActivityAt
        ? `No activity in ${inactivityDays} days.`
        : 'No recorded activity in this workspace yet.',
    }
  }

  const trend = deriveTrendDirection(recentCount, baselineCount, RECENT_WINDOW_DAYS, BASELINE_WINDOW_DAYS)

  if (trend === 'up') {
    return {
      stage: 'growing',
      label: 'Growing',
      reason: `${recentCount} new item${recentCount === 1 ? '' : 's'} in the last ${RECENT_WINDOW_DAYS} days, above its usual pace.`,
    }
  }

  if (trend === 'down' || inactivityDays >= STAGNANT_INACTIVITY_DAYS) {
    return {
      stage: 'stagnant',
      label: 'Stagnant',
      reason: `Activity has slowed — last update ${inactivityDays} day${inactivityDays === 1 ? '' : 's'} ago.`,
    }
  }

  if (ageDays >= MATURE_MIN_AGE_DAYS) {
    return {
      stage: 'mature',
      label: 'Mature',
      reason: `${ageDays} days old with a steady, ongoing pace of activity.`,
    }
  }

  return {
    stage: 'active',
    label: 'Active',
    reason: `${baselineCount} item${baselineCount === 1 ? '' : 's'} added in the last ${BASELINE_WINDOW_DAYS} days.`,
  }
}
