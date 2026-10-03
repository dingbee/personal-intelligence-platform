import type { Memory, ResourceScope, UUID } from '../domain/model'
import type { EvidenceReference, SourceReference } from '@/shared/provenance/types'

/**
 * V2-05 contracts for connecting the existing ARRIYIA knowledge/retrieval
 * substrate to the V2 control plane.
 *
 * These contracts do not replace V1 knowledge, retrieval or memory services.
 * They define the control-plane shape those existing capabilities can satisfy.
 */

export type KnowledgeItemKind =
  | 'document'
  | 'note'
  | 'conversation'
  | 'asset'
  | 'knowledge_node'
  | 'dataset'
  | 'external'

export interface KnowledgeReference extends ResourceScope {
  id: UUID
  kind: KnowledgeItemKind
  title: string
  source: SourceReference
  provenance?: EvidenceReference[]
  retrievedAt?: string
}

export interface KnowledgeQuery extends ResourceScope {
  query: string
  limit?: number
  kinds?: KnowledgeItemKind[]
}

export interface KnowledgeRetrievalResult {
  references: KnowledgeReference[]
  query: KnowledgeQuery
  retrievedAt: string
}

export type V2MemoryLifecycle = 'active' | 'paused' | 'expired' | 'archived'

export interface MemoryPolicy {
  allowedScopes: Memory['scope'][]
  defaultTtlDays?: number
  minimumConfidence?: number
  requireProvenance: boolean
}

export interface MemoryReference extends ResourceScope {
  id: UUID
  scope: Memory['scope']
  scopeId: UUID
  key: string
  value: unknown
  confidence?: number
  lifecycle: V2MemoryLifecycle
  provenance?: EvidenceReference[]
  expiresAt?: string
}

export interface KnowledgeMemoryContext {
  knowledge: KnowledgeReference[]
  memories: MemoryReference[]
  provenance: EvidenceReference[]
}

export interface KnowledgeMemoryAdapter {
  retrieveKnowledge(query: KnowledgeQuery): Promise<KnowledgeRetrievalResult>
  retrieveMemory(context: ResourceScope & { userId?: UUID; query?: string }): Promise<MemoryReference[]>
}
