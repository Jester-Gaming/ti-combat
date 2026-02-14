import type { CombatState } from './combat-state/combat-state'
import type { LogEntry } from './logger'

export type { LogEntry } from './logger'

/** A node in the probability tree */
export interface ProbabilityNode {
  id: string
  state: CombatState
  probability: number
  round: number
  children: ProbabilityNode[]
  log: LogEntry[]
}

/** State of a single surviving unit */
export interface SurvivorUnit {
  isDamaged?: boolean
  subtypes?: string[]
}

/** Surviving units for one side, grouped by unit type */
export type SurvivorSide = Partial<Record<string, SurvivorUnit[]>>

/** Final combat outcome with full survivor info */
export interface CombatOutcome {
  attacker: SurvivorSide
  defender: SurvivorSide
  winner: 'attacker' | 'defender' | 'draw'
  probability: number
}
