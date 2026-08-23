import type { AiMemory } from '@/shared/types/database'

/**
 * UX-14.2 Memory Evolution (Decay) — a documented half-life, not a cron job
 * or scheduled Edge Function: confidence is never mutated by a background
 * process. Instead, every read that ranks memories computes an *effective*
 * confidence on the fly from the stored value and how long it's been since
 * this memory was last corroborated. 90 days means a memory that hasn't
 * been reinforced in three months carries half the ranking weight of a
 * freshly reinforced one of the same original confidence — long enough
 * that an occasionally-mentioned preference doesn't decay away between
 * ordinary conversations, short enough that a genuinely stale inference
 * naturally cedes ranking priority to more recent, better-corroborated
 * information without ever being deleted or its stored confidence touched.
 */
export const CONFIDENCE_HALF_LIFE_DAYS = 90

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Read-time only, never persisted. Decays from `last_reinforced_at` when
 * set (the most recent evidence this memory is still correct), falling
 * back to `updated_at` for a memory that's never been reinforced — the
 * same reference point ranking already used before this decayed anything.
 * Returns null (never a fabricated number) for a memory with no stored
 * confidence at all — manually-authored memories and profile fields keep
 * their nullable-confidence semantics untouched by decay.
 */
export function computeEffectiveConfidence(
  memory: Pick<AiMemory, 'confidence' | 'last_reinforced_at' | 'updated_at'>,
  now: Date = new Date(),
): number | null {
  if (memory.confidence === null) return null

  const referenceTime = memory.last_reinforced_at ?? memory.updated_at
  // Clamped at 0 rather than left negative — clock skew or a reference
  // timestamp briefly in the future must never *inflate* confidence past
  // its stored value.
  const ageDays = Math.max(0, (now.getTime() - new Date(referenceTime).getTime()) / MS_PER_DAY)
  const decayFactor = Math.pow(0.5, ageDays / CONFIDENCE_HALF_LIFE_DAYS)
  return memory.confidence * decayFactor
}
