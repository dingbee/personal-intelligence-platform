import { supabase } from '@/shared/lib/supabase'
import type { AIProviderDescriptor } from '@/modules/core/providers/types'

export interface ProviderAvailability {
  anthropic: boolean
  openai: boolean
  google: boolean
}

/**
 * Runtime enable/disable overrides (Phase 8B.2), keyed by provider id.
 * `false` is the only state that excludes a provider; `undefined` (no row)
 * and `null` (explicitly reset) both mean "no override" — defer entirely to
 * key availability. Distinct from ProviderAvailability: this is ordinary
 * app data (provider_overrides, RLS-scoped per user), never a secret.
 */
export type ProviderOverrides = Record<string, boolean | null>

function isOverrideEnabled(providerId: string, overrides: ProviderOverrides | undefined): boolean {
  return overrides?.[providerId] !== false
}

/**
 * Whether a provider's API key is actually configured can only be known
 * server-side (Supabase function secrets, never sent to the client) — see
 * supabase/functions/provider-availability, which returns booleans only,
 * never key values, and is deliberately separate from ai-chat.
 *
 * If the call itself fails (network hiccup, cold start), fall back to
 * "only OpenAI" — the one provider this deployment has verified working
 * — rather than defaulting to "everything available" and risking exactly
 * the runtime errors this feature exists to prevent.
 */
const FALLBACK: ProviderAvailability = { anthropic: false, openai: true, google: false }

export async function getProviderAvailability(): Promise<ProviderAvailability> {
  const { data, error } = await supabase.functions.invoke<ProviderAvailability>('provider-availability')
  if (error || !data) return FALLBACK
  return data
}

/**
 * Provider Registry -> Availability Resolver -> Provider Selector: the
 * registry stays the sole source of truth for which providers *exist*
 * (status: 'available' means the code path is wired up at all); this
 * cross-references that list against which ones are actually usable right
 * now — both technically (key configured) and by choice (not runtime-
 * disabled via provider_overrides). Chat providers only — embedding
 * provider descriptors aren't relevant to this selector.
 */
export function resolveAvailableProviders(
  providers: AIProviderDescriptor[],
  availability: ProviderAvailability | undefined,
  overrides?: ProviderOverrides,
): AIProviderDescriptor[] {
  const wired = providers.filter((provider) => provider.kind === 'chat' && provider.status === 'available')
  return wired.filter((provider) => isProviderAvailable(provider.id, availability, overrides))
}

/**
 * True if a provider id is one this deployment can actually use right now:
 * a key must be configured (or availability data not yet loaded, in which
 * case we don't gate on it) AND it must not be explicitly disabled via a
 * provider_overrides row. Every call site that used to check availability
 * alone extends through this one function rather than adding a parallel
 * enabled/disabled check of its own.
 */
export function isProviderAvailable(
  providerId: string,
  availability: ProviderAvailability | undefined,
  overrides?: ProviderOverrides,
): boolean {
  const keyAvailable = !availability || (availability[providerId as keyof ProviderAvailability] ?? false)
  return keyAvailable && isOverrideEnabled(providerId, overrides)
}

/**
 * ai-chat returns a 500 with "<PROVIDER>_API_KEY is not configured" when a
 * provider's secret is missing (see handleChat) — distinct from a 502,
 * which means the provider itself rejected the request (rate limit, bad
 * request, etc.) and should keep showing its real message. Recognizing
 * this one shape client-side, without modifying ai-chat, is what lets
 * requirement 6 show a generic message instead of the raw upstream text.
 */
export function isProviderUnavailableError(message: string): boolean {
  return /\(500\)/.test(message) && /API_KEY is not configured/i.test(message)
}

export const PROVIDER_UNAVAILABLE_MESSAGE = 'Provider unavailable. Please select another AI provider.'
