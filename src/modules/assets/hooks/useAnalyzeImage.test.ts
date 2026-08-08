import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

/**
 * PIP Sprint 8/10 — regression test for the reliability defect found in
 * discovery: previously, `updateAssetMetadata` only ran after knowledge
 * extraction AND document intelligence both succeeded, so a failure in
 * either of those enrichment steps discarded a real, successfully-
 * completed vision analysis — the image was left looking exactly as if
 * "Analyze with NOVA" had never run. These tests pin the fixed contract:
 * the core analysis is persisted the moment it succeeds, and a later
 * step's failure never discards it.
 */
const { analyzeImageMock, updateAssetMetadataMock, indexAssetMock, runKnowledgeExtractionFromContentMock, runDocumentIntelligenceFromContentMock } =
  vi.hoisted(() => ({
    analyzeImageMock: vi.fn(),
    updateAssetMetadataMock: vi.fn(async () => ({}) as never),
    indexAssetMock: vi.fn(async () => {}),
    runKnowledgeExtractionFromContentMock: vi.fn(async () => ({ concepts: [], entities: [], edgesCreated: 0 })),
    runDocumentIntelligenceFromContentMock: vi.fn(async () => null as unknown),
  }))

vi.mock('@/modules/assets/intelligence/analyzeImage', () => ({ analyzeImage: analyzeImageMock }))
vi.mock('@/modules/assets/api/assets', () => ({ updateAssetMetadata: updateAssetMetadataMock }))
vi.mock('@/modules/search/indexing/indexAsset', () => ({ indexAsset: indexAssetMock }))
vi.mock('@/modules/knowledge-intelligence/api/knowledgeExtraction', () => ({ runKnowledgeExtractionFromContent: runKnowledgeExtractionFromContentMock }))
vi.mock('@/modules/processing/documentIntelligence/runDocumentIntelligence', () => ({
  runDocumentIntelligenceFromContent: runDocumentIntelligenceFromContentMock,
}))
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/modules/workspaces/useWorkspace', () => ({ useWorkspace: () => ({ currentWorkspaceId: 'workspace-1' }) }))
vi.mock('@/modules/ai/providers/useDefaultChatProviderId', () => ({ useDefaultChatProviderId: () => 'provider-1' }))
vi.mock('@/modules/ai/router/useProviderChain', () => ({ useProviderChain: () => ['provider-1'] }))

import { useAnalyzeImage } from '@/modules/assets/hooks/useAnalyzeImage'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

const ASSET = { id: 'asset-1', optimized_path: 'path/to/image.jpg', title: 'IMG_0231' }
const ANALYSIS = {
  description: 'A photo of a whiteboard.',
  extractedText: null,
  detectedLanguage: null,
  confidence: null,
  documentIntelligence: null,
  analyzedAt: '2026-01-01T00:00:00.000Z',
  provider: 'openai',
}

describe('useAnalyzeImage', () => {
  beforeEach(() => {
    analyzeImageMock.mockClear()
    updateAssetMetadataMock.mockClear()
    indexAssetMock.mockClear()
    runKnowledgeExtractionFromContentMock.mockClear()
    runDocumentIntelligenceFromContentMock.mockClear()
  })

  it('persists the core analysis, then enriches it, when every step succeeds', async () => {
    analyzeImageMock.mockResolvedValueOnce(ANALYSIS)
    runDocumentIntelligenceFromContentMock.mockResolvedValueOnce({ dates: [], decisions: [], tasks: [] })

    const { result } = renderHook(() => useAnalyzeImage(), { wrapper })
    result.current.mutate(ASSET)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Persisted twice: once with the core analysis immediately, once more with documentIntelligence merged in.
    expect(updateAssetMetadataMock).toHaveBeenCalledTimes(2)
    expect(updateAssetMetadataMock).toHaveBeenNthCalledWith(1, 'asset-1', ANALYSIS)
    expect(updateAssetMetadataMock).toHaveBeenNthCalledWith(2, 'asset-1', { ...ANALYSIS, documentIntelligence: { dates: [], decisions: [], tasks: [] } })
    expect(indexAssetMock).toHaveBeenCalled()
  })

  it('still persists the core analysis when knowledge extraction fails — a downstream enrichment failure must not discard a successful vision result', async () => {
    analyzeImageMock.mockResolvedValueOnce(ANALYSIS)
    runKnowledgeExtractionFromContentMock.mockRejectedValueOnce(new Error('extraction provider failed'))
    runDocumentIntelligenceFromContentMock.mockResolvedValueOnce(null)

    const { result } = renderHook(() => useAnalyzeImage(), { wrapper })
    result.current.mutate(ASSET)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateAssetMetadataMock).toHaveBeenNthCalledWith(1, 'asset-1', ANALYSIS)
    expect(result.current.data).toEqual({ ...ANALYSIS, documentIntelligence: null })
  })

  it('still persists the core analysis when document intelligence fails', async () => {
    analyzeImageMock.mockResolvedValueOnce(ANALYSIS)
    runDocumentIntelligenceFromContentMock.mockRejectedValueOnce(new Error('document intelligence provider failed'))

    const { result } = renderHook(() => useAnalyzeImage(), { wrapper })
    result.current.mutate(ASSET)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateAssetMetadataMock).toHaveBeenNthCalledWith(1, 'asset-1', ANALYSIS)
    expect(result.current.data).toEqual({ ...ANALYSIS, documentIntelligence: null })
  })

  it('fails the whole mutation, and never persists anything, when the vision analysis itself fails', async () => {
    analyzeImageMock.mockRejectedValueOnce(new Error('vision provider failed'))

    const { result } = renderHook(() => useAnalyzeImage(), { wrapper })
    result.current.mutate(ASSET)

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(updateAssetMetadataMock).not.toHaveBeenCalled()
    expect(indexAssetMock).not.toHaveBeenCalled()
  })
})
