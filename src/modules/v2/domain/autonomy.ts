/** Canonical V2 autonomy contract. Approval is a governance gate, not an autonomy level. */
export const AUTONOMY_LEVELS = ['inform', 'recommend', 'prepare', 'bounded'] as const
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]
const AUTONOMY_RANK: Record<AutonomyLevel, number> = { inform: 0, recommend: 1, prepare: 2, bounded: 3 }
export function isAutonomyLevel(value: string): value is AutonomyLevel { return (AUTONOMY_LEVELS as readonly string[]).includes(value) }
export function compareAutonomy(a: AutonomyLevel, b: AutonomyLevel): number { return AUTONOMY_RANK[a] - AUTONOMY_RANK[b] }
export function autonomyAtMost(requested: AutonomyLevel, ceiling: AutonomyLevel): boolean { return compareAutonomy(requested, ceiling) <= 0 }
