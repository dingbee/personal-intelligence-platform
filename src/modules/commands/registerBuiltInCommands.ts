import { commandRegistry } from '@/modules/commands/registry'
import { navigationCommands } from '@/modules/commands/commands/navigationCommands'
import { manageWorkspacesCommand, switchToAllWorkspacesCommand } from '@/modules/commands/commands/workspaceCommands'
import { askNovaCommand } from '@/modules/commands/commands/aiCommands'
import { openSearchCommand } from '@/modules/commands/commands/searchCommands'
import { createNoteCommand } from '@/modules/commands/commands/noteCommands'
import { manageMemoriesCommand, reviewMemorySuggestionsCommand } from '@/modules/commands/commands/memoryCommands'
import { openKnowledgeGraphCommand } from '@/modules/commands/commands/knowledgeCommands'
import {
  openIntelligenceDashboardCommand,
  showKnowledgeGrowthCommand,
  showAttentionItemsCommand,
  explainIntelligenceScoreCommand,
} from '@/modules/commands/commands/dashboardCommands'
import {
  planProjectCommand,
  planLearningCommand,
  planResearchCommand,
  planReadingCommand,
  planWritingCommand,
  planMigrationCommand,
} from '@/modules/commands/commands/planningCommands'

// Side-effect module, imported once from app/App.tsx — same pattern as
// modules/search/registerBuiltInProviders.ts. A future command
// ("Summarize this document", "Create flashcards", ...) is one more
// register() call here (or its own commands/*.ts file for a bigger
// group); the registry, filtering, and Command Bar UI never need to change.
// Per-context commands (workspace switches, "Continue reading", "Ask
// NOVA: <query>") are generated at render time instead — see
// useCommandContext/NovaCommandBar.
navigationCommands.forEach((command) => commandRegistry.register(command))
commandRegistry.register(manageWorkspacesCommand)
commandRegistry.register(switchToAllWorkspacesCommand)
commandRegistry.register(askNovaCommand)
commandRegistry.register(openSearchCommand)
commandRegistry.register(createNoteCommand)
commandRegistry.register(manageMemoriesCommand)
commandRegistry.register(reviewMemorySuggestionsCommand)
commandRegistry.register(openKnowledgeGraphCommand)
commandRegistry.register(openIntelligenceDashboardCommand)
commandRegistry.register(showKnowledgeGrowthCommand)
commandRegistry.register(showAttentionItemsCommand)
commandRegistry.register(explainIntelligenceScoreCommand)
commandRegistry.register(planProjectCommand)
commandRegistry.register(planLearningCommand)
commandRegistry.register(planResearchCommand)
commandRegistry.register(planReadingCommand)
commandRegistry.register(planWritingCommand)
commandRegistry.register(planMigrationCommand)
