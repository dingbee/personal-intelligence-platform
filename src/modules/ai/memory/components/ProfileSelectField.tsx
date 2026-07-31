import { useState } from 'react'
import { InlineTextForm } from '@/shared/components/ui/InlineTextForm'

const OTHER_VALUE = '__other__'

/** UX-13.6 Phase 2 — a labeled dropdown backed by a curated option list, with an "Other…" escape hatch (InlineTextForm) for anything not in the list — including whatever custom value is already stored, so switching to this redesign never silently drops an existing answer. */
export function ProfileSelectField({
  label,
  options,
  value,
  onSelect,
  onClear,
}: {
  label: string
  options: string[]
  value: string | null
  onSelect: (value: string) => void
  onClear: () => void
}) {
  const [addingCustom, setAddingCustom] = useState(false)
  const isKnownOption = value !== null && options.includes(value)

  return (
    <div className="flex flex-col gap-1.5 border-b border-[var(--color-border)] py-3 first:pt-0 last:border-b-0 last:pb-0">
      <label className="text-xs font-medium text-[var(--color-ink-muted)]">{label}</label>
      {addingCustom ? (
        <InlineTextForm
          initialValue={!isKnownOption && value ? value : ''}
          placeholder={`Enter ${label.toLowerCase()}`}
          onSubmit={(next) => {
            onSelect(next)
            setAddingCustom(false)
          }}
          onCancel={() => setAddingCustom(false)}
        />
      ) : (
        <select
          value={isKnownOption ? value! : value ? OTHER_VALUE : ''}
          onChange={(e) => {
            if (e.target.value === OTHER_VALUE) setAddingCustom(true)
            else if (e.target.value === '') onClear()
            else onSelect(e.target.value)
          }}
          className="w-full rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm shadow-inset outline-none"
        >
          <option value="">Not set</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={OTHER_VALUE}>{value && !isKnownOption ? value : 'Other…'}</option>
        </select>
      )}
    </div>
  )
}
