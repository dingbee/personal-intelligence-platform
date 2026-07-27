import { useEffect, useRef, useState } from 'react'
import type { Profile } from '@/shared/types/database'
import { providerRegistry } from '@/modules/core/providers/registry'
import { StringListEditor } from '@/modules/settings/components/StringListEditor'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

type ProfileFields = Pick<
  Profile,
  | 'display_name'
  | 'profession'
  | 'role'
  | 'industry'
  | 'organization'
  | 'bio'
  | 'expertise'
  | 'goals'
  | 'interests'
  | 'preferred_response_style'
  | 'preferred_detail_level'
  | 'preferred_language'
  | 'preferred_ai_provider'
  | 'preferred_reading_style'
>

function fieldsFrom(profile: Profile): ProfileFields {
  const {
    display_name,
    profession,
    role,
    industry,
    organization,
    bio,
    expertise,
    goals,
    interests,
    preferred_response_style,
    preferred_detail_level,
    preferred_language,
    preferred_ai_provider,
    preferred_reading_style,
  } = profile
  return {
    display_name,
    profession,
    role,
    industry,
    organization,
    bio,
    expertise,
    goals,
    interests,
    preferred_response_style,
    preferred_detail_level,
    preferred_language,
    preferred_ai_provider,
    preferred_reading_style,
  }
}

/**
 * The Explicit Profile — everything here is typed in by the user, on
 * purpose. Deliberately separate from Learned Preferences (the ai_memory
 * table's `learned_preference` rows), which don't have an editor yet: this
 * milestone only lays that table's schema, so there's nothing inferred to
 * show here. When that lands, it must get its own reviewable/editable UI —
 * never silently folded into these fields.
 */
export function ProfileForm({
  profile,
  onSave,
  saving,
}: {
  profile: Profile
  onSave: (updates: Partial<Profile>) => void
  saving: boolean
}) {
  const [fields, setFields] = useState<ProfileFields>(() => fieldsFrom(profile))
  const hasLoadedOnce = useRef(false)

  useEffect(() => {
    if (!hasLoadedOnce.current) {
      setFields(fieldsFrom(profile))
      hasLoadedOnce.current = true
    }
  }, [profile])

  const chatProviders = providerRegistry.list().filter((provider) => provider.kind === 'chat')

  function set<K extends keyof ProfileFields>(key: K, value: ProfileFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(fields)
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Display name"
          value={fields.display_name ?? ''}
          onChange={(e) => set('display_name', e.target.value || null)}
        />
        <Input
          label="Profession"
          value={fields.profession ?? ''}
          onChange={(e) => set('profession', e.target.value || null)}
        />
        <Input label="Role" value={fields.role ?? ''} onChange={(e) => set('role', e.target.value || null)} />
        <Input
          label="Industry"
          value={fields.industry ?? ''}
          onChange={(e) => set('industry', e.target.value || null)}
        />
        <Input
          label="Organization"
          value={fields.organization ?? ''}
          onChange={(e) => set('organization', e.target.value || null)}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-[var(--color-ink)]">Bio</span>
        <textarea
          value={fields.bio ?? ''}
          onChange={(e) => set('bio', e.target.value || null)}
          rows={3}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)]"
          placeholder="A short bio the AI can use to understand your background..."
        />
      </label>

      <StringListEditor label="Expertise" values={fields.expertise} onChange={(next) => set('expertise', next)} />
      <StringListEditor label="Goals" values={fields.goals} onChange={(next) => set('goals', next)} />
      <StringListEditor label="Interests" values={fields.interests} onChange={(next) => set('interests', next)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--color-ink)]">Response style</span>
          <select
            value={fields.preferred_response_style ?? ''}
            onChange={(e) => set('preferred_response_style', e.target.value || null)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
          >
            <option value="">No preference</option>
            <option value="concise">Concise</option>
            <option value="balanced">Balanced</option>
            <option value="thorough">Thorough</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--color-ink)]">Detail level</span>
          <select
            value={fields.preferred_detail_level ?? ''}
            onChange={(e) => set('preferred_detail_level', e.target.value || null)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
          >
            <option value="">No preference</option>
            <option value="brief">Brief</option>
            <option value="standard">Standard</option>
            <option value="in-depth">In-depth</option>
          </select>
        </label>

        <Input
          label="Preferred language"
          value={fields.preferred_language ?? ''}
          onChange={(e) => set('preferred_language', e.target.value || null)}
          placeholder="e.g. English"
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--color-ink)]">Preferred AI provider</span>
          <select
            value={fields.preferred_ai_provider ?? ''}
            onChange={(e) => set('preferred_ai_provider', e.target.value || null)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
          >
            <option value="">No preference</option>
            {chatProviders.map((provider) => (
              <option key={provider.id} value={provider.id} disabled={provider.status !== 'available'}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--color-ink)]">Reading style</span>
          <select
            value={fields.preferred_reading_style ?? ''}
            onChange={(e) => set('preferred_reading_style', e.target.value || null)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
          >
            <option value="">No preference</option>
            <option value="skim">Skim</option>
            <option value="deep-read">Deep read</option>
            <option value="study">Study</option>
          </select>
        </label>
      </div>

      <div>
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </div>
    </form>
  )
}
