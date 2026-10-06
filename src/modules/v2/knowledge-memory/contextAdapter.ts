import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { retrieveNoteContext, type NoteContextMatch } from '@/modules/ai/orchestration/retrieveNoteContext'
import { retrieveAssetContext, type AssetContextMatch } from '@/modules/ai/orchestration/retrieveAssetContext'
import { filterMemoriesByRelevance } from '@/modules/ai/memory/filterMemoriesByRelevance'
import { listMemories } from '@/modules/ai/memory/api/memory'
import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { listKnowledgeCollections } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import type { AiMemory, KnowledgeCollection, KnowledgeNode } from '@/shared/types/database'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'

const embeddingProvider = new OpenAIEmbeddingProvider()

export interface V2KnowledgeMemorySummary {
  knowledgeNodes: KnowledgeNode[]
  collections: KnowledgeCollection[]
  memories: AiMemory[]
}

export interface V2ContextEvidence {
  type: 'document' | 'note' | 'asset' | 'memory'
  id: string
  title: string
  excerpt: string
  score: number | null
}

export interface V2ContextSnapshot {
  query: string
  evidence: V2ContextEvidence[]
  counts: {
    documents: number
    notes: number
    assets: number
    memories: number
  }
}

export async function getV2KnowledgeMemorySummary(workspaceId: string | null): Promise<V2KnowledgeMemorySummary> {
  const [knowledgeNodes, collections, memories] = await Promise.all([
    listKnowledgeNodes({ workspaceId, limit: 100 }),
    listKnowledgeCollections({ workspaceId }),
    listMemories({ workspaceId, limit: 100 }),
  ])
  return { knowledgeNodes, collections, memories }
}

/**
 * V2-05 context adapter. It composes existing retrieval mechanisms into one
 * read-only contract. It does not create a second vector store, graph, or
 * memory system.
 */
export async function retrieveV2Context(params: {
  userId: string
  workspaceId: string | null
  query: string
}): Promise<V2ContextSnapshot> {
  const query = params.query.trim()
  if (!query) return { query: '', evidence: [], counts: { documents: 0, notes: 0, assets: 0, memories: 0 } }

  const embedding = (
    await embeddingProvider.embed([query], {
      userId: params.userId,
      workspaceId: params.workspaceId,
      feature: 'retrieval',
    })
  )[0]!

  const [documents, notes, assets, memories] = await Promise.all([
    retrieveContext({ query, userId: params.userId, workspaceId: params.workspaceId, embedding }).catch(() => [] as VectorMatch[]),
    retrieveNoteContext({ query, userId: params.userId, workspaceId: params.workspaceId, embedding }).catch(() => [] as NoteContextMatch[]),
    retrieveAssetContext({ query, userId: params.userId, workspaceId: params.workspaceId, embedding }).catch(() => [] as AssetContextMatch[]),
    listMemories({ workspaceId: params.workspaceId, limit: 200 }).then((rows) => filterMemoriesByRelevance(rows, query)).catch(() => [] as AiMemory[]),
  ])

  const evidence: V2ContextEvidence[] = [
    ...documents.map((match) => ({
      type: 'document' as const,
      id: match.documentId,
      title: 'Document evidence',
      excerpt: match.content,
      score: match.similarity,
    })),
    ...notes.map((match) => ({
      type: 'note' as const,
      id: match.noteId,
      title: match.title,
      excerpt: match.content,
      score: match.similarity,
    })),
    ...assets.map((match) => ({
      type: 'asset' as const,
      id: match.assetId,
      title: match.title,
      excerpt: match.content,
      score: match.similarity,
    })),
    ...memories.map((memory) => ({
      type: 'memory' as const,
      id: memory.id,
      title: memory.memory_type.replaceAll('_', ' '),
      excerpt: memory.content,
      score: memory.confidence,
    })),
  ]

  evidence.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  return {
    query,
    evidence: evidence.slice(0, 20),
    counts: {
      documents: documents.length,
      notes: notes.length,
      assets: assets.length,
      memories: memories.length,
    },
  }
}
