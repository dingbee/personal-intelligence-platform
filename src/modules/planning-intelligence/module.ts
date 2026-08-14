import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'
import { PLANNING_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/planningIntelligence'

/**
 * ARRIYIA Professional Intelligence — Planning Intelligence.
 *
 * Registers exactly ONE externally-exposed capability, following Data/
 * Analysis/Research Intelligence's own precedent. Unlike those three
 * engines, Planning Intelligence has no deterministic dataset/evidence
 * computation to loop over — the entire task is bounded reasoning over
 * already-assembled context (see buildPlanningContext.ts) — so a single
 * call IS the whole engine, not an intermediate step feeding a separate
 * final synthesis. This is the smallest architecture that satisfies the
 * brief's own flow (buildPlanningContext -> buildPlanningPrompt ->
 * executePlanningReasoning -> validatePlan -> returnStructuredPlan):
 * context assembly and validation are both pure/deterministic code
 * (buildPlanningContext.ts, validatePlan.ts) around this one AI call.
 *
 * requiredFeature: PLANNING_INTELLIGENCE_FEATURE_KEY
 * ('planning_intelligence') — a dedicated key distinct from
 * 'pro_intelligence' and every sibling engine's own key, following the
 * established precedent (see plans/planningIntelligence.ts).
 *
 * The response is structured JSON, not prose — see
 * api/parsePlanningResponse.ts, which validates every field before it
 * reaches the Plan record; nothing here is trusted at face value.
 *
 * Imported once, for its side effect, from app/App.tsx alongside every
 * other domain module's module.ts.
 */
registerPlatformModule({
  id: 'planning-intelligence',
  name: 'Planning Intelligence',
  capabilities: [
    {
      id: 'planning-generate-plan',
      label: 'Planning Intelligence',
      description: 'Transform a user objective and assembled context into a structured, inspectable, actionable plan — milestones, tasks, dependencies, risks, decisions, distinguishing known facts from assumptions and unknowns.',
      requiredFeature: PLANNING_INTELLIGENCE_FEATURE_KEY,
    },
  ],
  prompts: [
    {
      id: 'planning-generate-plan@1.0',
      capabilityId: 'planning-generate-plan',
      version: '1.0',
      active: true,
      template:
        'You are Planning Intelligence, turning a person\'s objective into a structured, actionable plan. The structured plan you ' +
        'return IS the product — not prose describing a plan. Every piece of context below (workspace objectives, retrieved passages) ' +
        'was actually retrieved from the person\'s own workspace — never invent a source, fact, deadline, budget figure, resource, or ' +
        'person that is not present below or explicitly stated in the objective/constraints.\n\n' +
        'For every fact you rely on, silently classify it before writing: KNOWN (the user explicitly stated it, or it is directly ' +
        'present in the context below), ASSUMED (a reasonable inference you are making, not stated outright), or UNKNOWN/REQUIRES ' +
        'USER INPUT (a genuine gap the plan depends on that only the user can resolve). Use these classifications in the assumptions ' +
        'array below — do not blur an assumption into a stated fact anywhere else in your response. If the user did not supply a ' +
        'deadline, do not invent one (milestone "target" stays null). If the user did not supply a budget, do not invent one (do not ' +
        'add a "budget" constraint with a fabricated figure). If a task genuinely requires information you do not have, still include ' +
        'the task, but add a corresponding decision or assumption flagging exactly what is missing.\n\n' +
        'If the objective is too vague, empty, or fundamentally unplannable (e.g. it names no concrete goal at all), decline rather ' +
        'than fabricate a plan around a guess.\n\n' +
        'Respond with ONLY one of these two JSON shapes (no markdown code fences, no other text):\n\n' +
        '1. A structured plan:\n' +
        '{\n' +
        '  "title": "<short label for this plan, distinct from the raw objective text>",\n' +
        '  "description": "<1-2 sentence plain-text description>",\n' +
        '  "currentState": "<the situation today, or null if genuinely not determinable>",\n' +
        '  "desiredOutcome": "<what success looks like, or null>",\n' +
        '  "gapAnalysis": "<what separates current state from desired outcome, or null>",\n' +
        '  "assumptions": [ { "statement": "<...>", "origin": "known"|"assumed"|"unknown"|"requires_user_input", "confidence": "low"|"medium"|"high" } ],\n' +
        '  "constraints": [ { "constraint": "<...>", "type": "time"|"budget"|"resource"|"technical"|"organizational"|"other", "severity": "hard"|"soft", "origin": "known"|"assumed" } ] (empty array if none genuinely apply — never invent one to fill the field),\n' +
        '  "milestones": [ { "localId": "m1", "title": "<...>", "description": "<...>", "target": "<free-text timing, or null>", "sequence": 1, "dependsOn": ["<other milestone localIds, or empty>"] } ],\n' +
        '  "tasks": [ { "localId": "t1", "title": "<...>", "description": "<...>", "priority": "low"|"medium"|"high", "sequence": 1, "dependsOn": ["<other task localIds, or empty>"], "milestoneId": "<a milestone localId from above, or null>", "estimatedEffort": "<free-text estimate, or null if you have no honest basis>", "requiredResources": ["<...>"] } ],\n' +
        '  "risks": [ { "risk": "<...>", "probability": "low"|"medium"|"high"|null, "impact": "low"|"medium"|"high", "mitigation": "<...>"|null } ],\n' +
        '  "decisions": [ { "decision": "<a decision the user needs to make>", "options": [ { "option": "<...>", "tradeoff": "<...>"|null } ], "recommendation": "<...>"|null, "unresolved": true|false } ],\n' +
        '  "outputs": [ { "deliverable": "<expected output>", "completionCriteria": "<how you know it is done>" } ],\n' +
        '  "successCriteria": ["<...>"]\n' +
        '}\n\n' +
        '2. A decline, only when the objective genuinely cannot be planned as given:\n' +
        '{ "declined": true, "reason": "<one clear sentence>" }\n\n' +
        'Every milestone/task "sequence" is a 1-based ordering within its own list. Every "dependsOn"/"milestoneId" must reference a ' +
        'localId you actually defined above in this same response — never a placeholder or an id from a different response. Keep the ' +
        'plan proportional to the objective: a small objective should not be inflated with dozens of trivial tasks, and a large one ' +
        'should not be flattened into three vague steps.\n\n' +
        '{{planningSummary}}',
    },
  ],
})
