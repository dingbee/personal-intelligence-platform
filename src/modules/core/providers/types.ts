export type ProviderKind = 'chat' | 'embedding'
export type ProviderStatus = 'planned' | 'available'

/**
 * Metadata about a pluggable AI provider — not the provider implementation
 * itself. The actual `EmbeddingProvider` contract lives in modules/ai/embeddings
 * (and a future `ChatProvider` contract will live in modules/ai/providers);
 * this registry just tracks which providers exist as plugins and whether
 * they're wired up yet, so UI (e.g. a provider picker) doesn't need to
 * hardcode the list.
 */
export interface AIProviderDescriptor {
  id: string
  label: string
  kind: ProviderKind
  status: ProviderStatus
  moduleId?: string
}
