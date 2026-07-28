import type { AiMemoryType } from '@/shared/types/database'

/**
 * Output of the detection engine — never persisted (see module README/
 * commit message: UX-5.3B keeps this in-memory only, ai_memory is
 * untouched until a human approves via MemoryApprovalPanel).
 */
export interface MemoryCandidate {
  content: string
  type: AiMemoryType
  /** 0..1 — see scoreMemoryConfidence for how this is derived. */
  confidence: number
  sourceConversationId: string
}
