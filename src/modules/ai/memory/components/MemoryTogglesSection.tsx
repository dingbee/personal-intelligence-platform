import { useMemories } from '@/modules/ai/memory/hooks/useMemories'
import type { AiMemoryType } from '@/shared/types/database'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'

const TOGGLES: { type: AiMemoryType; label: string; description: string }[] = [
  { type: 'explicit_profile', label: 'Remember my profile', description: 'Occupation, industry, expertise, goals, and everything else in the Profile section above.' },
  { type: 'learned_preference', label: 'Remember learned preferences', description: 'Preferences NOVA infers from how you interact with it.' },
  { type: 'conversation_memory', label: 'Remember conversation context', description: 'Facts NOVA picks up from things you say in chat.' },
]

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors ${on ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-raised transition-transform ${on ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

/**
 * UX-13.6 Phase 2 — bulk enable/disable per memory type, reusing
 * setMemoryCategoryActive (specified in the UX-5.3A brief but never
 * wired to any UI until now). "On" means every memory of that type is
 * currently active; toggling off disables every existing memory of that
 * type in one call — reversible, not a delete.
 *
 * The brief's "Remember long-term projects" / "Remember workspaces"
 * examples are intentionally not included: there's no memory_type or
 * other real data category behind either concept, and adding toggles
 * that don't actually control anything would be exactly the kind of
 * fabricated control this redesign is supposed to replace.
 */
export function MemoryTogglesSection() {
  const { data: memories = [], setCategoryActive } = useMemories({ includeInactive: true })

  function isCategoryOn(type: AiMemoryType): boolean {
    const ofType = memories.filter((m) => m.memory_type === type)
    return ofType.length === 0 || ofType.every((m) => m.is_active)
  }

  return (
    <SurfaceCard className="flex flex-col gap-1">
      <div className="pb-2">
        <SectionHeader level="section" title="Memory" description="What NOVA is allowed to remember." />
      </div>
      {TOGGLES.map(({ type, label, description }) => (
        <div key={type} className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] py-3 last:border-b-0 last:pb-0">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">{label}</p>
            <p className="text-xs text-[var(--color-ink-muted)]">{description}</p>
          </div>
          <Toggle
            on={isCategoryOn(type)}
            onChange={(next) => setCategoryActive.mutate({ memoryType: type, isActive: next })}
          />
        </div>
      ))}
    </SurfaceCard>
  )
}
