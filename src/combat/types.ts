/** State of a single surviving unit */
interface SurvivorUnit {
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
