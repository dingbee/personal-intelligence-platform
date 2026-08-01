import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSearch } from '@/modules/search/hooks/useSearch'
import { useConceptSearch } from '@/modules/search/hooks/useConceptSearch'
import { hasAnyIndexableContent } from '@/modules/search/api/hasIndexableContent'
import { SearchResultCard } from '@/modules/search/components/SearchResultCard'
import { ConceptCard } from '@/modules/knowledge-intelligence/components/ConceptCard'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Spinner } from '@/shared/components/ui/Spinner'

export function SearchPage() {
  const { search, results, loading, error } = useSearch()
  // UX-13.11 Phase 2B — the Graph Layer branch: a distinct "what do I know
  // about X" section, run in parallel with (not merged into) the flat
  // document/note/conversation results above.
  const { search: searchConcepts, concepts, loading: conceptsLoading } = useConceptSearch()
  const [searchParams] = useSearchParams()
  const [queryText, setQueryText] = useState(() => searchParams.get('q') ?? '')
  const [hasSearched, setHasSearched] = useState(false)
  const autoRunRef = useRef(false)

  // UX-13.11 Phase 3 — zero-result recovery: null while unknown/not
  // applicable, otherwise whether the account has any indexable content at
  // all. Only checked once a search has genuinely come back empty, so it
  // never runs on a normal search.
  const [hasAnyContent, setHasAnyContent] = useState<boolean | null>(null)
  const isEmpty = hasSearched && !loading && !conceptsLoading && results.length === 0 && concepts.length === 0
  useEffect(() => {
    if (!isEmpty) {
      setHasAnyContent(null)
      return
    }
    let cancelled = false
    void hasAnyIndexableContent().then((result) => {
      if (!cancelled) setHasAnyContent(result)
    })
    return () => {
      cancelled = true
    }
  }, [isEmpty])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setHasSearched(true)
    void search(queryText)
    void searchConcepts(queryText)
  }

  // Deep-linked from the Command Bar's "Search library for '<query>'" —
  // runs the exact same search() as submitting the form manually would,
  // once per mount.
  useEffect(() => {
    const q = searchParams.get('q')
    if (!q || autoRunRef.current) return
    autoRunRef.current = true
    setHasSearched(true)
    void search(q)
    void searchConcepts(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Search</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Semantic search across your documents, notes, and past conversations, plus what your knowledge graph already
          knows — finds what you mean, not just what you typed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Search"
            placeholder="What have I learned about..."
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
        </div>
        <Button type="submit" loading={loading} disabled={!queryText.trim()}>
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {hasSearched && !conceptsLoading && concepts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">Knowledge</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {concepts.map((evidence) => (
              <ConceptCard key={evidence.node.id} evidence={evidence} />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !hasSearched ? (
        <EmptyState
          title="Search your knowledge base"
          description="Ask something like “what have I learned about customer experience?” — results come from your documents and chat history, ranked by meaning."
        />
      ) : isEmpty ? (
        hasAnyContent === false ? (
          <EmptyState
            title="Your library is empty"
            description="Upload a document, write a note, or start a conversation — Search will find it once something's there."
          />
        ) : (
          <EmptyState
            title="No results"
            description="Nothing matched closely enough. Try rephrasing, or check that your documents have finished processing."
          />
        )
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((result) => (
            <SearchResultCard key={`${result.sourceType}-${result.sourceId}-${result.snippet.slice(0, 20)}`} result={result} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
