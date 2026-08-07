import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { listKnowledgeNodes, listKnowledgeNodeSourcesForNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { listKnowledgeLinks } from '@/modules/knowledge-graph/api/graph'
import { getKnowledgeInsights } from '@/modules/knowledge-intelligence/api/knowledgeInsights'
import { generateKnowledgeMap, getConceptSourceNodes } from '@/modules/knowledge-intelligence/api/knowledgeMap'
import { runKnowledgeExtraction } from '@/modules/knowledge-intelligence/api/knowledgeExtraction'
import { reconcileKnowledgeGraph, listRecentAutoDiscoveredConnections } from '@/modules/knowledge-intelligence/api/reconcileKnowledgeGraph'
import { detectTopicalKnowledgeGaps } from '@/modules/knowledge-intelligence/api/detectTopicalKnowledgeGaps'
import { runIntelligenceQuery } from '@/modules/knowledge-intelligence/queries/runIntelligenceQuery'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'

/** Readiness hooks for a future Knowledge Intelligence UI (Phase 7B+) — no visualization consumes these yet. */

export function useKnowledgeNodes(documentId?: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-nodes', currentWorkspaceId, documentId],
    queryFn: () => listKnowledgeNodes({ workspaceId: currentWorkspaceId, documentId }),
    enabled: Boolean(user),
  })
}

export function useKnowledgeEdges() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-edges', currentWorkspaceId],
    queryFn: () => listKnowledgeLinks(currentWorkspaceId),
    enabled: Boolean(user),
  })
}

/** UX-10 Phase 4/9 — backs the Relationship Explorer's "shared documents" basis; same nodeIds-keyed query shape as useKnowledgeNodeDetails already uses. */
export function useKnowledgeNodeSources(nodeIds: string[]) {
  return useQuery({
    queryKey: ['knowledge-node-sources', nodeIds],
    queryFn: () => listKnowledgeNodeSourcesForNodes(nodeIds),
    enabled: nodeIds.length > 0,
  })
}

export function useKnowledgeInsights() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-insights', currentWorkspaceId],
    queryFn: () => getKnowledgeInsights(currentWorkspaceId),
    enabled: Boolean(user),
  })
}

export function useKnowledgeMap() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-map', currentWorkspaceId],
    queryFn: () => generateKnowledgeMap(currentWorkspaceId),
    enabled: Boolean(user),
  })
}

/** Knowledge Intelligence Layer v1, Feature 6 — manually triggered (same cost-consciousness as useReconcileKnowledgeGraph): a topical gap suggestion is a real AI call, not a free deterministic computation like computeKnowledgeGaps. */
export function useDetectTopicalKnowledgeGaps() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: () =>
      withProviderAvailability(
        chain,
        () => detectTopicalKnowledgeGaps({ userId: user!.id, workspaceId: currentWorkspaceId, chain }),
        { queryClient },
      ),
  })
}

/** Knowledge Intelligence Layer v1, Feature 2 — "does this connect to something you already know?" surfaced from the edges autoReconcileNewKnowledge already wrote. */
export function useRecentAutoDiscoveredConnections() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-auto-discovered-connections', currentWorkspaceId],
    queryFn: () => listRecentAutoDiscoveredConnections(currentWorkspaceId),
    enabled: Boolean(user),
  })
}

/** Knowledge Intelligence Layer v1, Feature 1 — "Show sources" toggle on the AI Knowledge Graph. Only fetches while `enabled` (the toggle is on) and there's at least one concept node to resolve sources for. */
export function useConceptSourceNodes(nodeIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['knowledge-concept-source-nodes', nodeIds],
    queryFn: () => getConceptSourceNodes(nodeIds),
    enabled: enabled && nodeIds.length > 0,
  })
}

export function useRunKnowledgeExtraction(documentId: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: () =>
      withProviderAvailability(
        chain,
        () => runKnowledgeExtraction({ documentId, userId: user!.id, workspaceId: currentWorkspaceId, chain }),
        { queryClient },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-nodes'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-edges'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-insights'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-map'] })
    },
  })
}

/**
 * Phase 9B: cross-document reconciliation — distinct from
 * useRunKnowledgeExtraction, which only ever compares nodes within one
 * document's own fresh extraction. Manually triggered only; not wired
 * into any UI yet (deferred to Phase 9C).
 */
export function useReconcileKnowledgeGraph() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: () =>
      withProviderAvailability(
        chain,
        () => reconcileKnowledgeGraph({ userId: user!.id, workspaceId: currentWorkspaceId, chain }),
        { queryClient },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-edges'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-insights'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-map'] })
    },
  })
}

/** Knowledge Intelligence Layer v1, Feature 5 — the query box on a concept's detail page: the node is already known from the route, so this only needs to classify the *kind* of question, not resolve which concept it's about. */
export function useIntelligenceQuery(nodeId: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: (text: string) =>
      withProviderAvailability(
        chain,
        () => runIntelligenceQuery({ text, nodeId, userId: user!.id, workspaceId: currentWorkspaceId, chain }),
        { queryClient },
      ),
  })
}
