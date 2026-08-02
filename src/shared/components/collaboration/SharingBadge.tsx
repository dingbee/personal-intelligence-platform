import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

/**
 * UX-14.5 Phase 5 — deliverable #5: Personal vs. Shared badge. Reuses
 * `StatusBadge` rather than introducing a second badge primitive —
 * "Shared" is deliberately not tied merely to `workspace_id` being set:
 * a workspace with only its owner in it is still personal in every
 * meaningful sense, so callers should pass `isShared` computed from
 * actual member count (e.g. `useWorkspaceMemberDirectory(workspaceId)
 * .isShared`), not from workspace_id's presence alone.
 */
export function SharingBadge({ isShared }: { isShared: boolean }) {
  return isShared ? <StatusBadge label="Shared" variant="info" /> : <StatusBadge label="Personal" variant="neutral" />
}
