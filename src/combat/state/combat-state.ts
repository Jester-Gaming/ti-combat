import type { DieValue, UnitType } from '@/types'

import { AbilitiesTracker, type DiceData } from '../abilities'
import { getCombinedDiceDistribution } from '../dice'
import { CombatSideState } from './combat-side-state'

/** Hit source determines dice collection */
type HitSource = 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON'

/** Combat side identifier */
type CombatSide = 'attacker' | 'defender'

/** A state with its probability and hit metadata */
interface StateWithProbability {
  state: CombatState
  probability: number
  meta?: { attacker: number; defender: number }
}

/** Ground forces that can be targeted by bombardment */
const GROUND_FORCE_TYPES: UnitType[] = ['INFANTRY', 'MECH']

/** Valid targets by hit source */
function getValidTargets(source: HitSource): UnitType[] {
  switch (source) {
    case 'COMBAT':
      return [] // All ships valid (empty = all)
    case 'AFB':
      return ['FIGHTER']
    case 'BOMBARDMENT':
      return GROUND_FORCE_TYPES
    case 'SPACE_CANNON':
      return [] // All ships valid
  }
}

/** Main combat state encapsulating both sides */
export class CombatState {
  readonly attacker: CombatSideState
  readonly defender: CombatSideState
  readonly abilities: AbilitiesTracker

  constructor(
    attacker: CombatSideState,
    defender: CombatSideState,
    abilities?: AbilitiesTracker,
  ) {
    this.attacker = attacker
    this.defender = defender
    this.abilities =
      abilities ??
      AbilitiesTracker.create({
        attacker: { abilities: [] },
        defender: { abilities: [] },
      })
  }

  /** Collect dice for a side and source */
  collectDice(side: CombatSide, source: HitSource): DieValue[] {
    const participatingUnits = this.getParticipatingUnits(side)
    return this[side].collectDice(source, participatingUnits)
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
    // Create mutable DiceData for abilities to modify
    const diceData: DiceData = {
      attackerDice: [...attackerDice],
      defenderDice: [...defenderDice],
    }

    // Run BEFORE_DICE_ROLL abilities with alternating mechanism
    this.abilities.runAbilities('BEFORE_DICE_ROLL', this, diceData)

    const attackerDist = getCombinedDiceDistribution(diceData.attackerDice)
    const defenderDist = getCombinedDiceDistribution(diceData.defenderDice)
    const validTargets = getValidTargets(source)

    const results: StateWithProbability[] = []

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        let newState = this.clone()
        // Attacker hits go to defender, defender hits go to attacker
        newState = newState.addHitsToSide(
          'defender',
          attOutcome.hits,
          validTargets,
        )
        newState = newState.addHitsToSide(
          'attacker',
          defOutcome.hits,
          validTargets,
        )

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
    hits: number,
    validTargets: UnitType[],
  ): CombatState {
    if (hits === 0) return this

    const newSideState = this[side].addHits(hits, validTargets)
    const [attacker, defender] =
      side === 'attacker'
        ? [newSideState, this.defender]
        : [this.attacker, newSideState]

    return new CombatState(attacker, defender, this.abilities)
  }

  /** Assign hits from pools for both sides */
  assignHits(): CombatState {
    this.abilities.runAbilities('BEFORE_ASSIGN_HITS', this)

    const attackerParticipating = this.getParticipatingUnits('attacker')
    const defenderParticipating = this.getParticipatingUnits('defender')
    const attackerPriority = this.getUnitPriority('attacker')
    const defenderPriority = this.getUnitPriority('defender')

    const newAttacker = this.attacker.assignHits(
      attackerParticipating,
      attackerPriority,
    )
    const newDefender = this.defender.assignHits(
      defenderParticipating,
      defenderPriority,
    )

    return new CombatState(newAttacker, newDefender, this.abilities)
  }

  /** Get participating units from PARTICIPATING_UNITS ability */
  getParticipatingUnits(side: CombatSide): ReadonlySet<UnitType> {
    const ability = this.abilities.forSide(side).get('PARTICIPATING_UNITS')
    if (!ability) {
      // Fallback: all units with count > 0 are participating
      return new Set(Object.keys(this[side].units) as UnitType[])
    }
    return new Set(ability.params.space as UnitType[])
  }

  /** Get unit priority from UNIT_PRIORITY ability if present */
  private getUnitPriority(side: CombatSide): UnitType[] | undefined {
    const ability = this.abilities.forSide(side).get('UNIT_PRIORITY')
    if (!ability) return undefined
    return ability.params.unitPriority as UnitType[] | undefined
  }

  /** Create a deep clone of this state */
  clone(): CombatState {
    return new CombatState(
      this.attacker.clone(),
      this.defender.clone(),
      this.abilities.clone(),
    )
  }

  /** Check if combat is finished (one or both sides' participating units eliminated) */
  isFinished(): boolean {
    const attackerParticipating = this.getParticipatingUnits('attacker')
    const defenderParticipating = this.getParticipatingUnits('defender')
    const attackerAlive = this.attacker.countUnits(attackerParticipating) > 0
    const defenderAlive = this.defender.countUnits(defenderParticipating) > 0
    return !attackerAlive || !defenderAlive
  }

  /** Generate a hash for state comparison and caching */
  getHash(): string {
    return `${getSideHash(this.attacker)}|${getSideHash(this.defender)}`
  }
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
