import type { CombatState } from './state/combat-state'

export type LogEntry = [string, ...unknown[]]

/** A node in the probability tree */
export interface ProbabilityNode {
  id: string
  state: CombatState
  probability: number
  round: number
  children: ProbabilityNode[]
  log: LogEntry[]
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
