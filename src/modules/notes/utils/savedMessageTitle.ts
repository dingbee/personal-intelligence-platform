/**
 * AI Workspace Actions v1 — Save to Notes. Pure title derivation: the
 * message's own first line (specific — you might save several messages
 * from the same conversation over time, so the conversation's title alone
 * wouldn't distinguish them), falling back to the conversation title only
 * when the message has no usable content.
 */
export function buildSavedMessageTitle(message: { content: string }, conversationTitle: string): string {
  const trimmed = message.content.trim()
  if (!trimmed) return `From: ${conversationTitle}`
  const firstLine = trimmed.split('\n')[0]!.trim()
  if (!firstLine) return `From: ${conversationTitle}`
  return firstLine.length > 60 ? `${firstLine.slice(0, 59)}…` : firstLine
}
