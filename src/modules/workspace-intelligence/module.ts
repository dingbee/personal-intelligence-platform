import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'

/** UX-14.4 — Workspace Intelligence. Objective assistance is advisory only:
 * it may assess progress from recorded workspace evidence, but it never
 * changes objective state or executes an action without the user. */
registerPlatformModule({
  id: 'workspace-intelligence',
  name: 'Workspace Intelligence',
  capabilities: [
    {
      id: 'workspace-briefing',
      label: 'Workspace Briefing',
      description: "Synthesize a workspace's objectives, recent activity, and open gaps into a structured status briefing.",
      requiredFeature: 'pro_intelligence',
    },
    {
      id: 'workspace-objective-review',
      label: 'Workspace Objective Review',
      description: 'Assess active workspace objectives against recorded activity, established knowledge, gaps, user goals, and recommendations.',
      requiredFeature: 'pro_intelligence',
    },
  ],
  prompts: [
    {
      id: 'workspace-briefing@1.0',
      capabilityId: 'workspace-briefing',
      version: '1.0',
      active: true,
      template:
        'You are writing a status briefing for "{{workspaceName}}", a professional working environment, for the ' +
        'person who owns it. Base the briefing only on the information given below — do not invent facts, ' +
        'activity, or conclusions that are not listed. Write short paragraphs (no markdown, no headings) that ' +
        'clearly address, in order: what this workspace is currently working on, its stated objective(s), what ' +
        'has already been established, what remains unresolved, and what should be worked on next. If a section ' +
        'has nothing recorded, say so plainly rather than guessing.\n\n' +
        'Objectives:\n{{objectives}}\n\nRecent activity:\n{{recentActivity}}\n\n' +
        'Established (knowledge maturity and active concepts):\n{{established}}\n\n' +
        'Unresolved (open knowledge gaps):\n{{unresolved}}\n\nRecommended next steps:\n{{recommendedNext}}',
    },
    {
      id: 'workspace-objective-review@1.0',
      capabilityId: 'workspace-objective-review',
      version: '1.0',
      active: true,
      template:
        'Review the active objectives for "{{workspaceName}}" using only the supplied workspace evidence and the user\'s explicit goals. ' +
        'For each active objective, state: alignment with the user\'s goals when evidence exists, current evidence of progress, ' +
        'relevant unresolved gaps, and the most useful next step. Distinguish evidence from inference. Never claim an objective is ' +
        'complete unless it is explicitly recorded as completed. Do not change objective status, invent deadlines, invent activity, ' +
        'or create actions. If there is insufficient evidence, say that clearly. Keep the review concise and practical.\n\n' +
        'User goals:\n{{userGoals}}\n\nActive objectives:\n{{activeObjectives}}\n\nCompleted objectives:\n{{completedObjectives}}\n\n' +
        'Recent activity:\n{{recentActivity}}\n\nEstablished knowledge:\n{{established}}\n\nUnresolved gaps:\n{{unresolved}}\n\n' +
        'Recommended next steps:\n{{recommendedNext}}',
    },
  ],
})
