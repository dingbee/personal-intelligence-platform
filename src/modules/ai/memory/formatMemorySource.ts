/**
 * Maps the raw `ai_memory.source` value to the label shown in the memory
 * management UI. `null` covers every memory that exists today — manual
 * entry (Settings, command palette) is the only write path until UX-5.3B's
 * automatic detection lands and starts writing 'conversation'.
 */
export function formatMemorySource(source: string | null): string {
  switch (source) {
    case 'conversation':
      return 'Learned from conversation'
    case 'import':
      return 'Imported'
    default:
      return 'User provided'
  }
}
