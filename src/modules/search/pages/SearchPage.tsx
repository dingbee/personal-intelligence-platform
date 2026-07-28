import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSearch } from '@/modules/search/hooks/useSearch'
import { SearchResultCard } from '@/modules/search/components/SearchResultCard'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Spinner } from '@/shared/components/ui/Spinner'

export function SearchPage() {
  const { search, results, loading, error } = useSearch()
  const [searchParams] = useSearchParams()
  const [queryText, setQueryText] = useState(() => searchParams.get('q') ?? '')
  const [hasSearched, setHasSearched] = useState(false)
  const autoRunRef = useRef(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setHasSearched(true)
    void search(queryText)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Search</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Semantic search across your documents and past conversations — finds what you mean, not just what you typed.
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !hasSearched ? (
        <EmptyState
          title="Search your knowledge base"
          description="Ask something like “what have I learned about customer experience?” — results come from your documents and chat history, ranked by meaning."
        />
      ) : results.length === 0 ? (
        <EmptyState
          title="No results"
          description="Nothing matched closely enough. Try rephrasing, or check that your documents have finished processing."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((result) => (
            <SearchResultCard key={`${result.sourceType}-${result.sourceId}-${result.snippet.slice(0, 20)}`} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
