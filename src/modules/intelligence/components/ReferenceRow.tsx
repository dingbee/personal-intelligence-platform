import { ReferenceChip } from '@/modules/intelligence/components/ReferenceChip'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'

/** Renders nothing when there are no references — replaces the old plain "Based on N passages" text with real clickable chips when references resolved, still degrading gracefully to nothing rather than a broken row. */
export function ReferenceRow({ references }: { references: Reference[] }) {
  if (references.length === 0) return null

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {references.map((reference, index) => (
        <ReferenceChip key={`${reference.type}-${index}`} reference={reference} />
      ))}
    </div>
  )
}
