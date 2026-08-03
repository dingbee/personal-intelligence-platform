import { useState } from 'react'
import { useNotes } from '@/modules/notes/hooks/useNotes'
import { useConversations } from '@/modules/ai/chat/hooks/useConversations'
import { useKnowledgeNodes } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import { useAssets } from '@/modules/assets/hooks/useAssets'
import { useKnowledgeCollections } from '@/modules/knowledge-intelligence/hooks/useKnowledgeCollections'
import { buildExportRequestForObject, type ExportableObjectType } from '@/modules/export/exportCenterRequests'
import { generateExport } from '@/modules/export/exportService'
import { EXPORT_FORMAT_OPTIONS, type ExportFormat } from '@/modules/export/types'
import { downloadBinaryFile } from '@/shared/utils/downloadBinaryFile'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

interface TabConfig {
  type: ExportableObjectType
  label: string
}

const TABS: TabConfig[] = [
  { type: 'note', label: 'Notes' },
  { type: 'conversation', label: 'Conversations' },
  { type: 'knowledge_node', label: 'Concepts' },
  { type: 'document', label: 'Documents' },
  { type: 'asset', label: 'Images' },
  { type: 'knowledge_collection', label: 'Collections' },
]

interface ListItem {
  id: string
  title: string
  subtitle?: string
}

type ItemStatus = 'pending' | 'exporting' | 'done' | 'error'
interface ItemResult {
  id: string
  title: string
  status: ItemStatus
  error?: string
}

/**
 * UX-15.1 — one place to export any of the six knowledge object types,
 * closing the discovery's #2 finding (Import entry points scattered
 * across three unrelated pages, no single hub). This page does no
 * export logic of its own: `buildExportRequestForObject` fetches and
 * dispatches to each object type's own existing, unmodified content
 * adapter + `export<Type>Package`, and `generateExport` is the exact
 * same dispatch function `KnowledgeExportDialog` already calls. "Only
 * display formats that apply to the selected object" (the task's own
 * Phase 3 requirement) is trivially satisfied after this phase's own
 * Phase 2 fix: all four formats now apply uniformly to every object
 * type (Documents/Assets previously supported NOVA Package only), so
 * there is no real restriction left to encode here.
 */
export function ExportCenterPage() {
  const [activeType, setActiveType] = useState<ExportableObjectType>('note')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<ExportFormat>('nova')
  const [results, setResults] = useState<ItemResult[] | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const notes = useNotes()
  const conversations = useConversations()
  const nodes = useKnowledgeNodes()
  const documents = useDocuments({})
  const assets = useAssets()
  const collections = useKnowledgeCollections()

  const listsByType: Record<ExportableObjectType, { items: ListItem[]; isLoading: boolean }> = {
    note: { items: (notes.data ?? []).map((n) => ({ id: n.id, title: n.title })), isLoading: notes.isLoading },
    conversation: {
      items: (conversations.data ?? []).map((c) => ({ id: c.id, title: c.title })),
      isLoading: conversations.isLoading,
    },
    knowledge_node: {
      items: (nodes.data ?? []).map((n) => ({ id: n.id, title: n.title, subtitle: n.node_type === 'concept' ? 'Concept' : 'Entity' })),
      isLoading: nodes.isLoading,
    },
    document: {
      items: (documents.data ?? []).map((d) => ({ id: d.id, title: d.title, subtitle: d.file_type })),
      isLoading: documents.isLoading,
    },
    asset: { items: assets.assets.map((a) => ({ id: a.id, title: a.title })), isLoading: assets.isLoading },
    knowledge_collection: {
      items: (collections.data ?? []).map((c) => ({ id: c.id, title: c.name })),
      isLoading: collections.isLoading,
    },
  }

  const activeList = listsByType[activeType]

  function selectTab(type: ExportableObjectType) {
    setActiveType(type)
    setSelectedIds(new Set())
    setResults(null)
  }

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) => (prev.size === activeList.items.length ? new Set() : new Set(activeList.items.map((item) => item.id))))
  }

  async function handleExport() {
    const selected = activeList.items.filter((item) => selectedIds.has(item.id))
    setIsExporting(true)
    setResults(selected.map((item) => ({ id: item.id, title: item.title, status: 'pending' })))

    for (const item of selected) {
      setResults((prev) => prev!.map((r) => (r.id === item.id ? { ...r, status: 'exporting' } : r)))
      try {
        const request = await buildExportRequestForObject({ type: activeType, id: item.id, title: item.title })
        const generated = await generateExport(format, request)
        downloadBinaryFile(generated.filename, await generated.blob.arrayBuffer(), generated.mimeType)
        setResults((prev) => prev!.map((r) => (r.id === item.id ? { ...r, status: 'done' } : r)))
      } catch (error) {
        setResults((prev) =>
          prev!.map((r) =>
            r.id === item.id ? { ...r, status: 'error', error: error instanceof Error ? error.message : 'Export failed' } : r,
          ),
        )
      }
    }
    setIsExporting(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        level="page"
        title="Export Center"
        description="Export one or more of your notes, conversations, concepts, documents, images, or collections from a single place."
      />

      <div role="tablist" aria-label="Object type" className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            role="tab"
            aria-selected={activeType === tab.type}
            onClick={() => selectTab(tab.type)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              activeType === tab.type
                ? 'bg-[var(--color-ink)] text-white'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeList.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : activeList.items.length === 0 ? (
        <EmptyState
          title={`No ${TABS.find((tab) => tab.type === activeType)!.label.toLowerCase()} yet`}
          description="Nothing to export here yet."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <input type="checkbox" checked={selectedIds.size === activeList.items.length} onChange={toggleAll} />
              Select all ({activeList.items.length})
            </label>
            <span className="text-sm text-[var(--color-ink-muted)]">{selectedIds.size} selected</span>
          </div>

          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-panel border border-[var(--color-border)] bg-[var(--surface-raised)] p-2">
            {activeList.items.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-2.5 rounded-control px-2.5 py-1.5 text-sm hover:bg-[var(--color-canvas)]">
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)} />
                  <span className="min-w-0 flex-1 truncate text-[var(--color-ink)]">{item.title}</span>
                  {item.subtitle && <span className="shrink-0 text-xs text-[var(--color-ink-muted)]">{item.subtitle}</span>}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
            <div role="radiogroup" aria-label="Export format" className="flex flex-wrap gap-3">
              {EXPORT_FORMAT_OPTIONS.map((option) => (
                <label key={option.format} className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--color-ink)]">
                  <input
                    type="radio"
                    name="export-center-format"
                    checked={format === option.format}
                    onChange={() => setFormat(option.format)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <Button disabled={selectedIds.size === 0} loading={isExporting} onClick={() => void handleExport()}>
              {selectedIds.size > 0 ? `Export ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}` : 'Export'}
            </Button>
          </div>

          {results && (
            <ul className="flex flex-col gap-1 rounded-panel border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm">
              {results.map((result) => (
                <li key={result.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[var(--color-ink)]">{result.title}</span>
                  <span
                    className={
                      result.status === 'done'
                        ? 'shrink-0 text-green-600'
                        : result.status === 'error'
                          ? 'shrink-0 text-red-600'
                          : 'shrink-0 text-[var(--color-ink-muted)]'
                    }
                  >
                    {result.status === 'pending' && 'Waiting…'}
                    {result.status === 'exporting' && 'Exporting…'}
                    {result.status === 'done' && 'Downloaded'}
                    {result.status === 'error' && (result.error ?? 'Failed')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
