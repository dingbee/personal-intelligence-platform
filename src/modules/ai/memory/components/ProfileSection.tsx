import { useProfileFields } from '@/modules/ai/memory/hooks/useProfileFields'
import { ProfileSelectField } from '@/modules/ai/memory/components/ProfileSelectField'
import { ProfileChipField } from '@/modules/ai/memory/components/ProfileChipField'
import {
  ANSWER_LENGTH_LABELS,
  COMMUNICATION_STYLE_OPTIONS,
  DECISION_STYLE_OPTIONS,
  EXPERTISE_OPTIONS,
  GOAL_OPTIONS,
  INDUSTRY_OPTIONS,
  OCCUPATION_OPTIONS,
  type AnswerLength,
} from '@/modules/ai/memory/profileFields'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'

const ANSWER_LENGTHS: AnswerLength[] = ['brief', 'balanced', 'detailed']

/**
 * UX-13.6 Phase 2 — "Who are you?" Every field here is an explicit_profile
 * ai_memory row (see profileFields.ts); nothing new is stored, and this
 * already-wired path (retrieveMemoryContext -> formatMemoriesForPrompt ->
 * AIService's system prompt) picks up every change automatically — no
 * AIService/retrieval/prompt code was touched to make that true.
 */
export function ProfileSection() {
  const profile = useProfileFields()

  return (
    <SurfaceCard className="flex flex-col gap-1">
      <div className="pb-2">
        <SectionHeader level="section" title="Profile" description="Who are you?" />
      </div>

      <ProfileSelectField
        label="Occupation"
        options={OCCUPATION_OPTIONS}
        value={profile.getSingle('occupation')}
        onSelect={(value) => profile.setSingleValue('occupation', value)}
        onClear={() => profile.clearSingleValue('occupation')}
      />
      <ProfileSelectField
        label="Primary Industry"
        options={INDUSTRY_OPTIONS}
        value={profile.getSingle('industry')}
        onSelect={(value) => profile.setSingleValue('industry', value)}
        onClear={() => profile.clearSingleValue('industry')}
      />
      <ProfileChipField
        label="Expertise"
        options={EXPERTISE_OPTIONS}
        selected={profile.getMulti('expertise')}
        onToggle={(value) => profile.toggleMultiValue('expertise', value)}
      />
      <ProfileChipField
        label="Goals"
        options={GOAL_OPTIONS}
        selected={profile.getMulti('goals')}
        onToggle={(value) => profile.toggleMultiValue('goals', value)}
      />
      <ProfileSelectField
        label="Communication Style"
        options={COMMUNICATION_STYLE_OPTIONS}
        value={profile.getSingle('communication_style')}
        onSelect={(value) => profile.setSingleValue('communication_style', value)}
        onClear={() => profile.clearSingleValue('communication_style')}
      />

      <div className="flex flex-col gap-1.5 border-b border-[var(--color-border)] py-3">
        <span className="text-xs font-medium text-[var(--color-ink-muted)]">Preferred Answer Length</span>
        <div className="flex flex-wrap gap-4">
          {ANSWER_LENGTHS.map((length) => (
            <label key={length} className="flex items-center gap-1.5 text-sm text-[var(--color-ink)]">
              <input
                type="radio"
                name="answer-length"
                checked={profile.getSingle('answer_length') === length}
                onChange={() => profile.setSingleValue('answer_length', length)}
                className="accent-[var(--color-accent)]"
              />
              {ANSWER_LENGTH_LABELS[length]}
            </label>
          ))}
        </div>
      </div>

      <ProfileSelectField
        label="Decision Style"
        options={DECISION_STYLE_OPTIONS}
        value={profile.getSingle('decision_style')}
        onSelect={(value) => profile.setSingleValue('decision_style', value)}
        onClear={() => profile.clearSingleValue('decision_style')}
      />
    </SurfaceCard>
  )
}
