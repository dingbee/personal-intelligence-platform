import type { WorkspaceStats } from '@/modules/workspaces/api/workspaces'

export interface WorkspaceIntelligenceSummary {
  workspaceId: string
  workspaceName: string
  documentCount: number
  conceptCount: number
  connectionCount: number
  lastActivityAt: string | null
}

export interface WorkspaceRef {
  id: string
  name: string
}

export interface ResolveWorkspaceIntelligenceSummariesInput {
  workspaces: WorkspaceRef[]
  /** Keyed by workspace id — from getWorkspaceStats (reused, not recomputed). */
  stats: Map<string, WorkspaceStats>
  /** Keyed by workspace id — count of AI-generated (generated_by set) knowledge_links per workspace. */
  connectionCounts: Map<string, number>
}

/**
 * UX-11 Phase 8 — one summary per workspace, entirely from data
 * getWorkspaceStats (Phase 8's own workspace_id-scoped 8-query aggregate,
 * pre-existing) and the graph's own edge count already provide. No new
 * per-workspace query beyond the connection count, which reuses
 * listKnowledgeLinks (UX-10/Phase 6C) the same way knowledgeMap.ts already
 * does.
 */
export function resolveWorkspaceIntelligenceSummaries(
  input: ResolveWorkspaceIntelligenceSummariesInput,
): WorkspaceIntelligenceSummary[] {
  return input.workspaces.map((workspace) => {
    const stats = input.stats.get(workspace.id)
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      documentCount: stats?.documents ?? 0,
      conceptCount: stats?.knowledgeNodes ?? 0,
      connectionCount: input.connectionCounts.get(workspace.id) ?? 0,
      lastActivityAt: stats?.lastActivityAt ?? null,
    }
  })
}
