import { supabase } from '@/shared/lib/supabase'
import type { AIProviderDescriptor } from '@/modules/core/providers/types'

export interface ProviderAvailability {
  anthropic: boolean
  openai: boolean
  google: boolean
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
 * cross-references that list against which ones are actually usable
 * right now. Chat providers only — embedding provider descriptors aren't
 * relevant to this selector.
 */
export function resolveAvailableProviders(
  providers: AIProviderDescriptor[],
  availability: ProviderAvailability | undefined,
): AIProviderDescriptor[] {
  const wired = providers.filter((provider) => provider.kind === 'chat' && provider.status === 'available')
  if (!availability) return wired
  return wired.filter((provider) => availability[provider.id as keyof ProviderAvailability] ?? false)
}

/** True if a provider id is one this deployment can actually use right now. */
export function isProviderAvailable(providerId: string, availability: ProviderAvailability | undefined): boolean {
  if (!availability) return true
  return availability[providerId as keyof ProviderAvailability] ?? false
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
