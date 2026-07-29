import { Button } from '@/shared/components/ui/Button'

/** UX-6 Phase 5/7 — renders whatever generateFollowUpSuggestions produced this turn; never a hardcoded default set, so it renders nothing when the array is empty. */
export function NovaSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: string[]
  onSelect: (suggestion: string) => void
}) {
  if (suggestions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <Button key={suggestion} variant="secondary" onClick={() => onSelect(suggestion)}>
          {suggestion}
        </Button>
      ))}
    </div>
  )
}
