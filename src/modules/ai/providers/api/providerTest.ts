import { getChatProvider } from '@/modules/ai/providers/registry'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { normalizeAiError, type AiErrorCategory } from '@/modules/ai/orchestration/normalizeAiError'

export interface ProviderTestResult {
  providerId: string
  success: boolean
  latencyMs: number
  category?: AiErrorCategory
  message?: string
}

const TEST_SYSTEM_PROMPT = 'You are a connectivity check. Reply with exactly one word: ok'
const TEST_MESSAGE = 'ping'

/**
 * A real, minimal ai-chat call — not a new edge function, not a new error
 * taxonomy. `feature: 'provider-test'` is the only thing distinguishing it
 * from a normal chat message, so it logs to ai_requests exactly like any
 * other call (see logAiRequest inside streamChatCompletion) and is excluded
 * from health/usage/trend aggregation purely by that feature tag (see
 * useAiHealth.ts). This is what actually proves key *validity* — a key can
 * be present (per provider-availability) but revoked or rate-limited, and
 * only a live call reveals that.
 */
export async function runProviderTest(
  providerId: string,
  userId: string,
  workspaceId: string | null,
): Promise<ProviderTestResult> {
  const start = performance.now()
  try {
    await streamChatCompletion({
      provider: getChatProvider(providerId),
      messages: [{ role: 'user', content: TEST_MESSAGE }],
      system: TEST_SYSTEM_PROMPT,
      userId,
      workspaceId,
      feature: 'provider-test',
    })
    return { providerId, success: true, latencyMs: Math.round(performance.now() - start) }
  } catch (err) {
    const normalized = normalizeAiError(err)
    return {
      providerId,
      success: false,
      latencyMs: Math.round(performance.now() - start),
      category: normalized.category,
      message: normalized.message,
    }
  }
}
