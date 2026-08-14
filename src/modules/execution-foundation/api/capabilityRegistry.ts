/**
 * The Execution Capability Registry — sprint brief Phase 4's own explicit
 * requirement: capability boundaries must be an explicit, named,
 * inspectable table, never a generic `execute(action)` that could reach
 * anything. Only capabilities with an existing SAFE internal primitive
 * (Action Intelligence's own Save-to-Notes / Add-Objective / Link-
 * Objective hooks — see executeCapability.ts) are `available` in this
 * phase. Every capability with a genuine external side effect is
 * registered as `unavailable` on purpose: the system can name the
 * capability and explain why it can't run it yet, rather than either
 * silently attempting it or pretending it doesn't exist.
 */

export type ExecutionCapabilityAvailability = 'available' | 'unavailable'

export interface ExecutionCapabilityDescriptor {
  id: string
  label: string
  description: string
  availability: ExecutionCapabilityAvailability
  /** True for every capability that would reach something outside this platform's own database — email, calendar, messaging, third-party APIs, money movement. */
  externalSideEffects: boolean
  /** Only set on an unavailable capability — the honest reason, shown in the UI instead of a generic error. */
  unavailableReason?: string
}

const EXTERNAL_UNAVAILABLE_REASON = 'This capability reaches outside ARRIYIA and belongs to a future Execution layer — it is not wired to anything yet.'

const CAPABILITIES: readonly ExecutionCapabilityDescriptor[] = [
  {
    id: 'save_action_to_notes',
    label: 'Save action to Notes',
    description: "Save this action's own title/description/readiness/dependencies as a Note — reuses saveActionSetToNote.ts, never a duplicate write path.",
    availability: 'available',
    externalSideEffects: false,
  },
  {
    id: 'add_action_as_workspace_objective',
    label: 'Add action as Workspace Objective',
    description: 'Add this action as a new workspace objective — reuses addActionAsWorkspaceObjective.ts.',
    availability: 'available',
    externalSideEffects: false,
  },
  {
    id: 'link_action_to_workspace_objective',
    label: 'Link action to existing Workspace Objective',
    description: 'Append a reference to this action onto an existing workspace objective — reuses linkActionToWorkspaceObjective.ts.',
    availability: 'available',
    externalSideEffects: false,
  },
  {
    id: 'send_email',
    label: 'Send email',
    description: 'Send an email on the user’s behalf.',
    availability: 'unavailable',
    externalSideEffects: true,
    unavailableReason: EXTERNAL_UNAVAILABLE_REASON,
  },
  {
    id: 'create_calendar_event',
    label: 'Create calendar event',
    description: 'Create an event on the user’s external calendar.',
    availability: 'unavailable',
    externalSideEffects: true,
    unavailableReason: EXTERNAL_UNAVAILABLE_REASON,
  },
  {
    id: 'send_message',
    label: 'Send message',
    description: 'Send a message (chat/SMS/etc.) on the user’s behalf.',
    availability: 'unavailable',
    externalSideEffects: true,
    unavailableReason: EXTERNAL_UNAVAILABLE_REASON,
  },
  {
    id: 'external_api_call',
    label: 'External API call',
    description: 'Call an arbitrary third-party API on the user’s behalf.',
    availability: 'unavailable',
    externalSideEffects: true,
    unavailableReason: EXTERNAL_UNAVAILABLE_REASON,
  },
  {
    id: 'financial_transaction',
    label: 'Financial transaction',
    description: 'Move money or authorize a payment on the user’s behalf.',
    availability: 'unavailable',
    externalSideEffects: true,
    unavailableReason: EXTERNAL_UNAVAILABLE_REASON,
  },
]

const BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]))

export function listCapabilities(): readonly ExecutionCapabilityDescriptor[] {
  return CAPABILITIES
}

export function getCapability(id: string): ExecutionCapabilityDescriptor | undefined {
  return BY_ID.get(id)
}

/** False both for an unregistered id and a registered-but-unavailable one — the caller never needs to distinguish "unknown" from "known but off" to decide whether it may proceed. */
export function isCapabilityAvailable(id: string): boolean {
  return BY_ID.get(id)?.availability === 'available'
}
