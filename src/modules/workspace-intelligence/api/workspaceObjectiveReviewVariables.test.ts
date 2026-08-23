import { describe, expect, it } from 'vitest'
import { buildWorkspaceObjectiveReviewVariables } from './workspaceObjectiveReviewVariables'
import type { WorkspaceObjective } from '@/shared/types/database'
import type { WorkspaceHubState } from '@/modules/hub/hubData'

const objective = (content: string, status: WorkspaceObjective['status']): WorkspaceObjective => ({
  id: content,
  user_id: 'user-1',
  workspace_id: 'workspace-1',
  content,
  status,
  created_at: '2026-08-23T00:00:00.000Z',
  updated_at: '2026-08-23T00:00:00.000Z',
})

const hub = {
  recentNotes: [{ title: 'Research plan' }],
  activeConversations: [{ title: 'Market analysis' }],
  activeConcepts: [{ title: 'ARRIYIA', status: 'active' }],
  gaps: [{ message: 'Pricing evidence is incomplete' }],
  recommendations: [{ reason: 'Review the unresolved pricing evidence', command: { id: 'review' } }],
  report: { maturity: { label: 'Developing', reason: 'Knowledge is growing' } },
} as unknown as WorkspaceHubState

describe('buildWorkspaceObjectiveReviewVariables', () => {
  it('separates active and completed objectives and includes only recorded workspace evidence', () => {
    const result = buildWorkspaceObjectiveReviewVariables(
      'Research Workspace',
      [objective('Finish literature review', 'active'), objective('Create source map', 'done')],
      hub,
    )

    expect(result.workspaceName).toBe('Research Workspace')
    expect(result.activeObjectives).toContain('Finish literature review')
    expect(result.activeObjectives).not.toContain('Create source map')
    expect(result.completedObjectives).toContain('Create source map')
    expect(result.recentActivity).toContain('Research plan')
    expect(result.recentActivity).toContain('Market analysis')
    expect(result.unresolved).toContain('Pricing evidence is incomplete')
    expect(result.recommendedNext).toContain('Review the unresolved pricing evidence')
  })

  it('uses explicit empty-state text instead of inventing missing evidence', () => {
    const emptyHub = {
      recentNotes: [],
      activeConversations: [],
      activeConcepts: [],
      gaps: [],
      recommendations: [],
      report: { maturity: { label: 'Unknown', reason: 'No report data' } },
    } as unknown as WorkspaceHubState

    const result = buildWorkspaceObjectiveReviewVariables('Empty', [], emptyHub)

    expect(result.activeObjectives).toBe('None recorded.')
    expect(result.completedObjectives).toBe('None recorded.')
    expect(result.recentActivity).toBe('No recent activity recorded.')
    expect(result.unresolved).toBe('No open knowledge gaps recorded.')
    expect(result.recommendedNext).toBe('No specific recommendation available yet.')
  })
})
