import type { DieValue, UnitStats, UnitType } from '@/types'
import type { CombatSide, Unit } from '../types'
import { getCombinedDiceDistribution } from '../dice'
import { CombatSideState } from './CombatSideState'
import type { HitSource } from './HitPool'

/** A state with its probability and hit metadata */
export interface StateWithProbability {
  state: CombatState
  probability: number
  meta?: { attacker: number; defender: number }
}

/** Main combat state encapsulating both sides */
export class CombatState {
  readonly attacker: CombatSideState
  readonly defender: CombatSideState

  constructor(attacker: CombatSideState, defender: CombatSideState) {
    this.attacker = attacker
    this.defender = defender
  }

  /** Factory method to create initial combat state */
  static create(
    attackerStats: Partial<Record<UnitType, UnitStats>>,
    attackerCounts: Partial<Record<UnitType, number>>,
    defenderStats: Partial<Record<UnitType, UnitStats>>,
    defenderCounts: Partial<Record<UnitType, number>>,
  ): CombatState {
    const attackerUnits = createUnitArrays(attackerCounts)
    const defenderUnits = createUnitArrays(defenderCounts)

    return new CombatState(
      new CombatSideState(attackerStats, attackerUnits),
      new CombatSideState(defenderStats, defenderUnits),
    )
  }

  /** Collect dice for a side and source */
  collectDice(side: CombatSide, source: HitSource): DieValue[] {
    return this[side].collectDice(source)
  }

  /**
   * Rolls provided dice and returns all possible outcomes with probabilities.
   * Attacker hits go to defender's pool and vice versa.
   */
  produceHits(
    attackerDice: DieValue[],
    defenderDice: DieValue[],
    source: HitSource,
  ): StateWithProbability[] {
    const attackerDist = getCombinedDiceDistribution(attackerDice)
    const defenderDist = getCombinedDiceDistribution(defenderDice)

    const results: StateWithProbability[] = []

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        let newState = this.clone()
        // Attacker hits go to defender, defender hits go to attacker
        newState = newState.addHitsToSide('defender', source, attOutcome.hits)
        newState = newState.addHitsToSide('attacker', source, defOutcome.hits)

        results.push({
          state: newState,
          probability,
          meta: { attacker: defOutcome.hits, defender: attOutcome.hits },
        })
      }
    }

    return results
  }

  /** Add hits to a side's hit pool */
  addHitsToSide(
    side: CombatSide,
    source: HitSource,
    hits: number,
  ): CombatState {
    if (hits === 0) return this

    const newSideState = this[side].addHits(source, hits)

    return side === 'attacker'
      ? new CombatState(newSideState, this.defender)
      : new CombatState(this.attacker, newSideState)
  }

  /** Assign hits from pools for a side, optionally filtering by source */
  assignHits(side: CombatSide, poolFilter?: HitSource): CombatState {
    const newSideState = this[side].assignHits(poolFilter)

    return side === 'attacker'
      ? new CombatState(newSideState, this.defender)
      : new CombatState(this.attacker, newSideState)
  }

  /** Create a deep clone of this state */
  clone(): CombatState {
    return new CombatState(this.attacker.clone(), this.defender.clone())
  }

  /** Check if combat is finished (one or both sides eliminated) */
  isFinished(): boolean {
    const attackerAlive = this.attacker.countUnits() > 0
    const defenderAlive = this.defender.countUnits() > 0
    return !attackerAlive || !defenderAlive
  }

  /** Generate a hash for state comparison and caching */
  getHash(): string {
    return `${getSideHash(this.attacker)}|${getSideHash(this.defender)}`
  }
}

function createUnitArrays(
  counts: Partial<Record<UnitType, number>>,
): Partial<Record<UnitType, Unit[]>> {
  const units: Partial<Record<UnitType, Unit[]>> = {}

  for (const [type, count] of Object.entries(counts)) {
    if (count && count > 0) {
      units[type as UnitType] = Array.from({ length: count }, () => ({}))
    }
  }

  return units
}

function getSideHash(side: CombatSideState): string {
  const parts: string[] = []

  const sortedTypes = Object.keys(side.units).sort()

  for (const type of sortedTypes) {
    const units = side.units[type as keyof typeof side.units]
    if (!units || units.length === 0) continue

    const unitStates = units.map(u => JSON.stringify(u)).join(',')
    parts.push(`${type}:[${unitStates}]`)
  }

  return parts.join(',')
}
