import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'

/**
 * ARRIYIA Professional Intelligence Phase P1 — Advanced AI Workspace.
 * Registers the first real Pro Intelligence capability: a workspace-wide
 * status briefing, synthesized from the same deterministic state the
 * Hub page already computes and shows (buildWorkspaceHubState) plus the
 * workspace's own objectives — no new retrieval, no second interpretation
 * of the same facts.
 *
 * requiredFeature: 'pro_intelligence' is the only plan boundary (see
 * runCapability.ts, Phase P0) — Free is denied here, Pro and Founding
 * Pro are admitted identically through the same has_feature resolution,
 * no plan-code branching anywhere in this module.
 *
 * Imported once, for its side effect, from app/App.tsx alongside
 * coreModule/knowledge-intelligence's module.ts.
 */
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
  ],
})
