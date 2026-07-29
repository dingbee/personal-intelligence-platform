import { getWorkspaceHeaderSummary, getWorkspaceName } from '@/modules/workspaces/api/workspaces'
import { getMostRecentReadingProgress } from '@/modules/reader/api/readingProgress'
import { listConversations } from '@/modules/ai/chat/api/conversations'
import { getProfile } from '@/modules/settings/api/profile'
import { buildContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import type {
  ActivityContext,
  KnowledgeContext,
  MemoryContext,
  NovaContext,
  UserContext,
  WorkspaceContext,
} from '@/modules/intelligence/context/types'

/** Most-recent-first conversation titles shown in ActivityContext — a glance, not a browse. */
const RECENT_CONVERSATIONS_LIMIT = 3

export interface ResolveNovaContextParams {
  userId: string
  workspaceId: string | null
  /** Whatever AIService already retrieved this turn (retrieveGraphContext/retrieveMemoryContext) — reused, never re-fetched. */
  graphContextText: string | null
  memoryContextText: string | null
}

async function resolveWorkspaceContext(workspaceId: string | null): Promise<WorkspaceContext | null> {
  try {
    const [summary, workspaceName] = await Promise.all([
      getWorkspaceHeaderSummary(workspaceId),
      workspaceId ? getWorkspaceName(workspaceId) : Promise.resolve(null),
    ])
    return { workspaceId, workspaceName, documentCount: summary.documentCount, lastActivityAt: summary.lastActivityAt }
  } catch {
    return null
  }
}

async function resolveActivityContext(workspaceId: string | null): Promise<ActivityContext | null> {
  try {
    const [inProgressDocument, conversations] = await Promise.all([
      getMostRecentReadingProgress(),
      listConversations({ workspaceId }),
    ])
    return {
      inProgressDocument,
      recentConversationTitles: conversations.slice(0, RECENT_CONVERSATIONS_LIMIT).map((c) => c.title),
    }
  } catch {
    return null
  }
}

async function resolveUserContext(userId: string): Promise<UserContext | null> {
  try {
    const profile = await getProfile(userId)
    return profile.display_name ? { displayName: profile.display_name } : null
  } catch {
    return null
  }
}

/** Pure — derives a node count from already-formatted graph context text via buildContextTrace, the same counting logic UX-5.2's internal trace already uses. Exported for direct unit testing without a Supabase mock. */
export function resolveKnowledgeContext(graphContextText: string | null): KnowledgeContext | null {
  if (!graphContextText) return null
  const { graphNodes } = buildContextTrace(0, graphContextText, null)
  return { graphSummary: graphContextText, nodeCount: graphNodes }
}

/** Pure — same idea as resolveKnowledgeContext, for memory. */
export function resolveMemoryContext(memoryContextText: string | null): MemoryContext | null {
  if (!memoryContextText) return null
  const { memoriesUsed } = buildContextTrace(0, null, memoryContextText)
  return { formattedText: memoryContextText, memoryCount: memoriesUsed }
}

/**
 * The NOVA Context Engine (UX-6 Phase 2) — an orchestration layer over
 * EXISTING sources, not a new retrieval path. Every field is resolved
 * independently and degrades to null on its own failure; this function
 * itself never throws, matching retrieveGraphContext/retrieveMemoryContext's
 * "swallow every error" contract so a bad context source can never break a
 * chat response.
 */
export async function resolveNovaContext(params: ResolveNovaContextParams): Promise<NovaContext> {
  const [workspaceContext, activityContext, userContext] = await Promise.all([
    resolveWorkspaceContext(params.workspaceId),
    resolveActivityContext(params.workspaceId),
    resolveUserContext(params.userId),
  ])

  return {
    workspaceContext,
    activityContext,
    knowledgeContext: resolveKnowledgeContext(params.graphContextText),
    memoryContext: resolveMemoryContext(params.memoryContextText),
    userContext,
  }
}
