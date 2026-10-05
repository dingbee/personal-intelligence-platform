import type { VerticalId, VerticalRegistration } from './types'

const registrations = new Map<VerticalId, VerticalRegistration>()

/**
 * Control-plane registry for externally supplied vertical contracts.
 *
 * ARRIYIA intentionally ships with zero product-owned vertical registrations.
 * Product runtimes publish contracts at an integration boundary instead of
 * being compiled into the ARRIYIA application bundle.
 */
export function registerVerticalContract(registration: VerticalRegistration): void {
  if (registrations.has(registration.verticalId)) {
    throw new Error(`Vertical contract already registered: ${registration.verticalId}`)
  }

  if (registration.executionAuthority !== 'nova-core') {
    throw new Error(`Invalid execution authority: ${registration.verticalId}`)
  }

  if (registration.governanceRequirements.approvalForConsequentialActions !== true) {
    throw new Error(`Consequential actions must remain approval-gated: ${registration.verticalId}`)
  }

  registrations.set(registration.verticalId, registration)
}

export function getVerticalContract(id: VerticalId): VerticalRegistration | undefined {
  return registrations.get(id)
}

export function listVerticalContracts(): VerticalRegistration[] {
  return Array.from(registrations.values())
}

export function clearVerticalContracts(): void {
  registrations.clear()
}
