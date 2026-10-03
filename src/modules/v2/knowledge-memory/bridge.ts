import type {
  KnowledgeMemoryAdapter,
  KnowledgeQuery,
  KnowledgeRetrievalResult,
  MemoryReference,
} from './contracts'

/**
 * V2-05 bridge boundary.
 *
 * The V2 control plane consumes knowledge and memory through this adapter.
 * Native V1 retrieval/memory implementations remain the source of truth.
 * No V2 persistence or duplicate retrieval engine is introduced here.
 */
export class V2KnowledgeMemoryBridge {
  constructor(private readonly adapter: KnowledgeMemoryAdapter) {}

  retrieveKnowledge(query: KnowledgeQuery): Promise<KnowledgeRetrievalResult> {
    return this.adapter.retrieveKnowledge(query)
  }

  retrieveMemory(
    context: Parameters<KnowledgeMemoryAdapter['retrieveMemory']>[0],
  ): Promise<MemoryReference[]> {
    return this.adapter.retrieveMemory(context)
  }

  async buildContext(
    query: KnowledgeQuery,
    context: Parameters<KnowledgeMemoryAdapter['retrieveMemory']>[0],
  ) {
    const [knowledge, memories] = await Promise.all([
      this.retrieveKnowledge(query),
      this.retrieveMemory(context),
    ])

    return {
      knowledge: knowledge.references,
      memories,
      provenance: knowledge.references.flatMap((reference) => reference.provenance ?? []),
    }
  }
}
