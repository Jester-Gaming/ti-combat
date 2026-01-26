import type { CombatState } from './state/combat-state'

export type { CombatSide } from './state/types'

/** A node in the probability tree */
export interface ProbabilityNode {
  state: CombatState
  probability: number
  round: number
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
  winner: 'attacker' | 'defender' | 'draw'
  probability: number
}
