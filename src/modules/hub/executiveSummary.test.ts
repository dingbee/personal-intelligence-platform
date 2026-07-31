import { describe, expect, it } from 'vitest'
import { buildExecutiveSummary } from '@/modules/hub/executiveSummary'
import type { WorkspaceMaturity } from '@/modules/evolution/workspaceEvolution/workspaceMaturity'
import type { DashboardRecommendation } from '@/modules/intelligence/dashboard/dashboardRecommendations'
import type { Command } from '@/modules/commands/types'

const maturity: WorkspaceMaturity = { stage: 'active', label: 'Active', reason: '4 items added in the last 30 days.' }

const stubCommand: Command = { id: 'stub', title: 'Stub', icon: '✨', category: 'navigation', execute: () => {} }

function recommendation(reason: string): DashboardRecommendation {
  return { category: 'explore', command: stubCommand, reason }
}

describe('buildExecutiveSummary', () => {
  it('narrates maturity and health with no gaps or recommendations', () => {
    const summary = buildExecutiveSummary({
      workspaceName: 'Research',
      maturity,
      health: { score: 90, issues: [] },
      gaps: [],
      recommendations: [],
    })
    expect(summary).toBe('Research is active — 4 items added in the last 30 days. Knowledge health is 90/100.')
  })

  it('mentions the gap count when gaps exist', () => {
    const summary = buildExecutiveSummary({
      workspaceName: 'Research',
      maturity,
      health: { score: 70, issues: [] },
      gaps: [
        { type: 'orphaned_concepts', message: 'x', count: 1 },
        { type: 'unread_documents', message: 'y', count: 1 },
      ],
      recommendations: [],
    })
    expect(summary).toContain('with 2 areas worth attention')
  })

  it('uses singular "area" for exactly one gap', () => {
    const summary = buildExecutiveSummary({
      workspaceName: 'Research',
      maturity,
      health: { score: 70, issues: [] },
      gaps: [{ type: 'orphaned_concepts', message: 'x', count: 1 }],
      recommendations: [],
    })
    expect(summary).toContain('with 1 area worth attention')
  })

  it('appends the top recommendation reason when recommendations exist', () => {
    const summary = buildExecutiveSummary({
      workspaceName: 'Research',
      maturity,
      health: { score: 90, issues: [] },
      gaps: [],
      recommendations: [recommendation('Pick up where you left off.'), recommendation('Capture a new thought.')],
    })
    expect(summary).toContain('Suggested next step: Pick up where you left off.')
    expect(summary).not.toContain('Capture a new thought.')
  })
})
