import type { KnowledgeNode } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { upsertKnowledgeEdges } from '@/modules/knowledge-intelligence/api/knowledgeEdges'
import { buildEdgeInputsFromRelationships } from '@/modules/knowledge-intelligence/api/knowledgeRelationships'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { parseRelationshipsResponse } from '@/modules/knowledge-intelligence/utils/parseKnowledgeExtractionResponse'

/** Bounds the prompt to a manageable, recent slice of the graph rather than every node a user has ever extracted — see the Phase 9B audit for why an unbounded cross-document scan doesn't fit in one prompt. */
const MAX_NODES = 60

export interface ReconcileKnowledgeGraphParams {
  userId: string
  workspaceId: string | null
  chain: string[]
}

export interface ReconcileKnowledgeGraphResult {
  nodesConsidered: number
  edgesCreated: number
}

/**
 * Phase 9B: same-document relationship detection (runKnowledgeExtraction)
 * only ever compares nodes extracted together from one document. This
 * reconciles across documents — it looks at the most recent nodes in a
 * user's graph regardless of source and asks the model to find
 * relationships between them, reusing the exact same matching/persistence
 * path (buildEdgeInputsFromRelationships + upsertKnowledgeEdges) as the
 * same-document path. Manually triggered only — not wired into the
 * per-document extraction flow.
 */
export async function reconcileKnowledgeGraph(params: ReconcileKnowledgeGraphParams): Promise<ReconcileKnowledgeGraphResult> {
  const { userId, workspaceId, chain } = params

  const nodes = await listKnowledgeNodes({ workspaceId, limit: MAX_NODES })
  if (nodes.length < 2) {
    return { nodesConsidered: nodes.length, edgesCreated: 0 }
  }

  const { result: relationshipsRun } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'detect-cross-document-relationships',
      variables: { nodes: JSON.stringify(nodes.map(describeNode)) },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  const relationshipItems = parseRelationshipsResponse(relationshipsRun.content)
  const edges = buildEdgeInputsFromRelationships(nodes, relationshipItems, {
    userId,
    workspaceId,
    generatedBy: 'ai:detect-cross-document-relationships',
  })

  await upsertKnowledgeEdges(edges)

  return { nodesConsidered: nodes.length, edgesCreated: edges.length }
}

function describeNode(node: KnowledgeNode) {
  return { title: node.title, type: node.node_type, description: node.description }
}

const MAX_RECENT_AUTO_CONNECTIONS = 5

export interface AutoDiscoveredConnection {
  edgeId: string
  sourceNodeId: string
  sourceTitle: string
  targetNodeId: string
  targetTitle: string
  relationshipType: string
  confidence: number | null
  createdAt: string
}

/**
 * Feature 2's "I found a connection" surface. Reads back the edges
 * autoReconcileNewKnowledge already wrote — no separate notification
 * table, `knowledge_links` rows tagged with AUTO_RECONCILE_GENERATED_BY
 * are themselves the record of what NOVA found automatically, distinct
 * from edges a user asked for via the manual Reconcile button.
 */
export async function listRecentAutoDiscoveredConnections(workspaceId: string | null): Promise<AutoDiscoveredConnection[]> {
  let query = supabase
    .from('knowledge_links')
    .select('*')
    .eq('source_type', 'knowledge_node')
    .eq('target_type', 'knowledge_node')
    .eq('generated_by', AUTO_RECONCILE_GENERATED_BY)
    .order('created_at', { ascending: false })
    .limit(MAX_RECENT_AUTO_CONNECTIONS)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data: edges, error } = await query
  if (error) throw error
  if (edges.length === 0) return []

  const nodeIds = Array.from(new Set(edges.flatMap((edge) => [edge.source_id, edge.target_id])))
  const { data: nodes, error: nodesError } = await supabase.from('knowledge_nodes').select('id, title').in('id', nodeIds)
  if (nodesError) throw nodesError
  const titleById = new Map(nodes.map((n) => [n.id, n.title]))

  return edges
    .map((edge) => ({
      edgeId: edge.id,
      sourceNodeId: edge.source_id,
      sourceTitle: titleById.get(edge.source_id),
      targetNodeId: edge.target_id,
      targetTitle: titleById.get(edge.target_id),
      relationshipType: edge.relationship_type ?? 'related_to',
      confidence: edge.confidence,
      createdAt: edge.created_at,
    }))
    .filter((c): c is AutoDiscoveredConnection => Boolean(c.sourceTitle && c.targetTitle))
}

/** Distinguishes automatically-discovered edges from the manual "Reconcile AI Knowledge Graph" button's edges (generated_by: 'ai:detect-cross-document-relationships') — lets the Hub surface only what NOVA found on its own. */
export const AUTO_RECONCILE_GENERATED_BY = 'ai:auto-detect-connections'

/** Kept small since this runs automatically after every extraction (unlike the manual reconcile button, which a user only clicks occasionally) — cost/latency needs to stay low for something that fires unattended. */
const MAX_EXISTING_NODES_FOR_AUTO_RECONCILE = 20

export interface AutoReconcileNewKnowledgeParams {
  /** The concepts/entities a single extraction run just created/updated — Feature 2's "new information enters." */
  newNodes: KnowledgeNode[]
  userId: string
  workspaceId: string | null
  chain: string[]
}

/**
 * Knowledge Intelligence Layer v1, Feature 2 — "does this connect to
 * something you already know?" answered automatically, not just via the
 * manual Reconcile button. Reuses the exact same match/persist path as
 * `reconcileKnowledgeGraph` (`detect-cross-document-relationships` +
 * buildEdgeInputsFromRelationships + upsertKnowledgeEdges) — this only
 * differs in scope: compares the nodes just created against a small,
 * bounded slice of the user's *other* recent nodes, instead of scanning
 * the whole graph. Meant to be called fire-and-forget (see
 * runKnowledgeExtractionFromContent) — never throws in a way that should
 * block the extraction it followed from succeeding.
 */
export async function autoReconcileNewKnowledge(params: AutoReconcileNewKnowledgeParams): Promise<ReconcileKnowledgeGraphResult> {
  const { newNodes, userId, workspaceId, chain } = params
  if (newNodes.length === 0) return { nodesConsidered: 0, edgesCreated: 0 }

  const newNodeIds = new Set(newNodes.map((n) => n.id))
  const recent = await listKnowledgeNodes({ workspaceId, limit: MAX_EXISTING_NODES_FOR_AUTO_RECONCILE + newNodes.length })
  const existingNodes = recent.filter((n) => !newNodeIds.has(n.id)).slice(0, MAX_EXISTING_NODES_FOR_AUTO_RECONCILE)
  if (existingNodes.length === 0) return { nodesConsidered: newNodes.length, edgesCreated: 0 }

  const nodes = [...newNodes, ...existingNodes]
  const { result: relationshipsRun } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'detect-cross-document-relationships',
      variables: { nodes: JSON.stringify(nodes.map(describeNode)) },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  const relationshipItems = parseRelationshipsResponse(relationshipsRun.content)
  const edges = buildEdgeInputsFromRelationships(nodes, relationshipItems, {
    userId,
    workspaceId,
    generatedBy: AUTO_RECONCILE_GENERATED_BY,
  })

  await upsertKnowledgeEdges(edges)

  return { nodesConsidered: nodes.length, edgesCreated: edges.length }
}
