import { createRegistry } from '@/modules/core/registry'
import type { Command } from '@/modules/commands/types'

// Same generic registry every other extension point in this app uses
// (capabilities, prompts, providers, workflows, search providers) — static
// commands register here once at module load; per-context commands
// (per-workspace switch, "Ask NOVA: <query>") are generated at render time
// instead, since they can't be known ahead of time. See
// registerBuiltInCommands.ts for where these get registered.
export const commandRegistry = createRegistry<Command>()
