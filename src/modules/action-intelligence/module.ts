import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'
import { ACTION_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/actionIntelligence'

/**
 * ARRIYIA Professional Intelligence — Action Intelligence.
 *
 * Registers exactly ONE externally-exposed capability, following
 * Planning/Decision Intelligence's own precedent: a single bounded call
 * proposes the action set; every deterministic downstream step —
 * dependency-cycle detection, readiness, prioritization — runs in this
 * application's own code (computeActionReadiness.ts,
 * analyzeActionDependencies.ts, computeActionPriorities.ts), never
 * trusted from the model's own claims. In particular the model may
 * propose `type` and `priority`, but it never gets to decide whether an
 * action is "ready" — see runActionIntelligence.ts.
 *
 * requiredFeature: ACTION_INTELLIGENCE_FEATURE_KEY — a dedicated key
 * distinct from every sibling engine's own key.
 */
registerPlatformModule({
  id: 'action-intelligence',
  name: 'Action Intelligence',
  capabilities: [
    {
      id: 'action-generate-action-set',
      label: 'Action Intelligence',
      description: 'Turn a decision, plan, evidence, or explicit instruction into a structured, traceable set of actions — this application, not the model, determines whether each one is actually ready to act on.',
      requiredFeature: ACTION_INTELLIGENCE_FEATURE_KEY,
    },
  ],
  prompts: [
    {
      id: 'action-generate-action-set@1.0',
      capabilityId: 'action-generate-action-set',
      version: '1.0',
      active: true,
      template:
        'You are Action Intelligence. Given the context below (a decision, a plan, retrieved evidence, and/or an explicit ' +
        'instruction), propose a structured, traceable set of actions — what needs to happen, in what order, by whom, and what ' +
        'each one depends on. You do NOT decide whether an action is ready to act on — the application computes that ' +
        'deterministically from the dependency/actor facts you provide, so propose those facts honestly rather than guessing at ' +
        'a final readiness state yourself.\n\n' +
        'Distinguish these five action types precisely: "action"/"task" are concrete work; "follow_up" is a check-in or ' +
        'monitoring step; "information_request" names a specific fact someone needs to go find or confirm; "decision_required" ' +
        'names a choice that has not yet been made and blocks further progress until it is (do not propose a course of action ' +
        'through a decision_required item — that would be inventing the outcome of a decision nobody made).\n\n' +
        'Never invent a deadline — only set "dueHint" when the context below genuinely states a timeframe. Never invent a named ' +
        'responsible person or team; if the context does not identify one, use actor type "unassigned" rather than guessing ' +
        '"the team" or a specific name. Never fabricate evidence citations — only cite an evidence number that was actually shown ' +
        'to you below, and only when it genuinely supports the action.\n\n' +
        'Respond with ONLY one of these two JSON shapes (no markdown code fences, no other text):\n\n' +
        '1. A structured action set:\n' +
        '{\n' +
        '  "title": "<short label for this action set>",\n' +
        '  "actions": [\n' +
        '    {\n' +
        '      "localId": "act1",\n' +
        '      "title": "<...>",\n' +
        '      "description": "<...>",\n' +
        '      "type": "action"|"task"|"follow_up"|"information_request"|"decision_required",\n' +
        '      "priority": "low"|"medium"|"high",\n' +
        '      "sequence": 1,\n' +
        '      "dependsOn": [ { "kind": "action", "targetLocalId": "<another action\'s localId>", "description": "<why>" } | ' +
        '{ "kind": "decision", "description": "<the unresolved decision that blocks this>" } | ' +
        '{ "kind": "objective", "objectiveNumber": <number from the workspace objectives list>, "description": "<why>" } ],\n' +
        '      "actor": { "type": "user"|"described"|"unassigned", "label": "<a specific name/role only if genuinely known/stated, else null>" },\n' +
        '      "expectedOutput": { "outcome": "<what completing this produces>", "completionCriteria": "<how you know it is done>"|null },\n' +
        '      "dueHint": "<free-text timing actually stated in context, or null>",\n' +
        '      "evidenceNumbers": [<numbers from the evidence list, or omit>]\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        '2. A decline, only when there is genuinely nothing actionable in the given context:\n' +
        '{ "declined": true, "reason": "<one clear sentence>" }\n\n' +
        'Every "targetLocalId" must reference a localId you actually defined among these same actions. Keep the action set ' +
        'proportional to the input: a small decision or instruction should not be inflated with dozens of trivial actions.\n\n' +
        '{{actionSummary}}',
    },
  ],
})
