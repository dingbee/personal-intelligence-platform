import { registerWorkspaceAction } from '@/modules/workspace-actions/registry'
import { generateBriefingAction } from '@/modules/workspace-actions/actions/generateBriefingAction'
import { saveToNotesAction } from '@/modules/workspace-actions/actions/saveToNotesAction'

/** Imported once, for its side effect, from app/App.tsx alongside coreModule/knowledge-intelligence's module.ts — same registration-on-import convention. */
registerWorkspaceAction(generateBriefingAction)
registerWorkspaceAction(saveToNotesAction)
