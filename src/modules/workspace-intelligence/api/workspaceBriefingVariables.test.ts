import { describe, expect, it } from 'vitest'
import { buildWorkspaceBriefingVariables } from '@/modules/workspace-intelligence/api/workspaceBriefingVariables'

const workspace = {
  id: 'workspace-1',
  user_id: 'user-1',
  name: 'Acme Launch',
  archived_at: null,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const baseHub = {
  report: { maturity: { label: 'Emerging', reason: 'Just getting started.', stage: 'emerging' } },
  activeConcepts: [],
  gaps: [],
  recommendations: [],
  recentNotes: [],
  activeConversations: [],
}

/**
 * Phase P1 Advanced AI Workspace — pure formatting only; no fetch, no AI
 * call. This is "workspace context resolution" (the mechanism the AI
 * runtime uses to know workspace name/objective/metadata) reduced to a
 * deterministic, fully testable function.
 */
describe('buildWorkspaceBriefingVariables', () => {
  it('formats the workspace name and a placeholder for an empty workspace', () => {
    const variables = buildWorkspaceBriefingVariables(workspace, [], baseHub as any)

    expect(variables.workspaceName).toBe('Acme Launch')
    expect(variables.objectives).toBe('None recorded.')
    expect(variables.recentActivity).toBe('No recent activity recorded.')
    expect(variables.unresolved).toBe('No open knowledge gaps recorded.')
    expect(variables.recommendedNext).toBe('No specific recommendation available yet.')
    expect(variables.established).toContain('Emerging — Just getting started.')
  })

  it('only includes active objectives, not done/dismissed ones', () => {
    const objectives = [
      { id: 'o1', workspace_id: 'workspace-1', user_id: 'user-1', content: 'Ship v1', status: 'active' as const, created_at: '', updated_at: '' },
      { id: 'o2', workspace_id: 'workspace-1', user_id: 'user-1', content: 'Old goal', status: 'done' as const, created_at: '', updated_at: '' },
      { id: 'o3', workspace_id: 'workspace-1', user_id: 'user-1', content: 'Dropped idea', status: 'dismissed' as const, created_at: '', updated_at: '' },
    ]

    const variables = buildWorkspaceBriefingVariables(workspace, objectives, baseHub as any)

    expect(variables.objectives).toBe('- Ship v1')
  })

  it('formats recent notes and active conversations as recent activity, in that order', () => {
    const hub = {
      ...baseHub,
      recentNotes: [{ title: 'Launch checklist' }, { title: '' }],
      activeConversations: [{ title: 'Pricing strategy' }],
    }

    const variables = buildWorkspaceBriefingVariables(workspace, [], hub as any)

    expect(variables.recentActivity).toBe('- Note: Launch checklist\n- Note: Untitled note\n- Conversation: Pricing strategy')
  })

  it('formats active concepts alongside the maturity narrative in "established"', () => {
    const hub = {
      ...baseHub,
      activeConcepts: [
        { title: 'Pricing model', status: 'growing' },
        { title: 'Target market', status: 'emerging' },
      ],
    }

    const variables = buildWorkspaceBriefingVariables(workspace, [], hub as any)

    expect(variables.established).toBe('Emerging — Just getting started.\n- Pricing model (growing)\n- Target market (emerging)')
  })

  it('formats knowledge gaps as unresolved', () => {
    const hub = { ...baseHub, gaps: [{ type: 'orphaned_concepts', message: '3 concepts have no source document.', count: 3 }] }

    const variables = buildWorkspaceBriefingVariables(workspace, [], hub as any)

    expect(variables.unresolved).toBe('- 3 concepts have no source document.')
  })

  it('formats up to 5 recommendations as recommended next steps', () => {
    const hub = { ...baseHub, recommendations: Array.from({ length: 7 }, (_, i) => ({ reason: `Recommendation ${i + 1}` })) }

    const variables = buildWorkspaceBriefingVariables(workspace, [], hub as any)

    expect(variables.recommendedNext.split('\n')).toHaveLength(5)
    expect(variables.recommendedNext).toContain('Recommendation 1')
    expect(variables.recommendedNext).not.toContain('Recommendation 6')
  })
})
