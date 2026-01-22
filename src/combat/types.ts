import type { UnitType, UnitStats } from '@/types'

export type CombatSide = 'attacker' | 'defender'

/** Per-unit state (empty now, abilities add properties like sustained) */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Unit {}

/** State for one side of combat */
export interface CombatSideState {
  stats: Partial<Record<UnitType, UnitStats>>
  units: Partial<Record<UnitType, Unit[]>>
  pendingHits: number
}

/** Full combat state at any point */
export interface CombatState {
  attacker: CombatSideState
  defender: CombatSideState
}

/** A probability-weighted state */
export interface ProbabilityState {
  state: CombatState
  meta?: Record<string, unknown>
  probability: number
}

/** A node in the probability tree */
export interface ProbabilityNode {
  state: CombatState
  probability: number // relative to parent, children sum to 1
  children: ProbabilityNode[]
  meta?: Record<string, unknown>
}

/** Survivor counts for one side */
export interface SurvivorSide {
  [unitType: string]: number
}

/** Final combat outcome with full survivor info */
export interface CombatOutcome {
  attacker: SurvivorSide
  defender: SurvivorSide
  winner: CombatSide | 'draw'
  probability: number
}
