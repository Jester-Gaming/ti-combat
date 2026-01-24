import type { DieValue, UnitType } from '@/types'

import {
  getAbilityParams,
  runAbilities,
  type SidedDiceData,
} from '../abilities'
import { getCombinedDiceDistribution } from '../dice'
import {
  addHits,
  assignHits as assignHitsSide,
  collectDice,
  countUnits,
  getOpponentSide,
} from './side-state-ops'
import type {
  AbilitiesConfig,
  CombatSide,
  CombatStateData,
  SideState,
} from './types'

/** Hit source determines dice collection */
type HitSource = 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON'

/** A state with its probability and hit metadata */
export interface StateWithProbability {
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

const EMPTY_ABILITIES: AbilitiesConfig = {
  attacker: { abilities: [] },
  defender: { abilities: [] },
}

/** Main combat state class */
export class CombatState implements CombatStateData {
  readonly data: CombatStateData

  get attacker(): SideState {
    return this.data.attacker
  }
  get defender(): SideState {
    return this.data.defender
  }
  get abilities(): AbilitiesConfig {
    return this.data.abilities
  }

  constructor(
    attacker: SideState,
    defender: SideState,
    abilities?: AbilitiesConfig,
  ) {
    this.data = {
      attacker,
      defender,
      abilities: abilities ?? EMPTY_ABILITIES,
    }
  }

  private static fromData(data: CombatStateData): CombatState {
    return new CombatState(data.attacker, data.defender, data.abilities)
  }

  /** Collect dice for a side and source */
  collectDice(side: CombatSide, source: HitSource): DieValue[] {
    const participatingUnits = this.getParticipatingUnits(side)
    return collectDice(this[side], source, participatingUnits)
  }

  /** Get participating units from PARTICIPATING_UNITS ability */
  getParticipatingUnits(side: CombatSide): ReadonlySet<UnitType> {
    const params = getAbilityParams(this.abilities, side, 'PARTICIPATING_UNITS')
    if (!params) {
      // Fallback: all units with count > 0 are participating
      return new Set(Object.keys(this.data[side].units) as UnitType[])
    }
    return new Set(params.space as UnitType[])
  }

  /** Get unit priority from UNIT_PRIORITY ability if present */
  private getUnitPriority(side: CombatSide): UnitType[] | undefined {
    const params = getAbilityParams(this.abilities, side, 'UNIT_PRIORITY')
    if (!params) return undefined
    return params.unitPriority as UnitType[] | undefined
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
    // Create sided context for abilities (attacker/defender format)
    const sidedDiceData: SidedDiceData = {
      attacker: [...attackerDice],
      defender: [...defenderDice],
    }

    // Run BEFORE_DICE_ROLL abilities with alternating mechanism
    const { state: newStateData, context: modifiedDice } = runAbilities(
      'BEFORE_DICE_ROLL',
      this.data,
      sidedDiceData,
    )

    const attackerDist = getCombinedDiceDistribution(modifiedDice.attacker)
    const defenderDist = getCombinedDiceDistribution(modifiedDice.defender)
    const validTargets = getValidTargets(source)

    const results: StateWithProbability[] = []

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        // Attacker hits go to defender, defender hits go to attacker
        let resultData = addHits(
          newStateData,
          'defender',
          attOutcome.hits,
          validTargets,
        )
        resultData = addHits(
          resultData,
          'attacker',
          defOutcome.hits,
          validTargets,
        )

        results.push({
          state: CombatState.fromData(resultData),
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

    const newData = addHits(this.data, side, hits, validTargets)
    return CombatState.fromData(newData)
  }

  /** Assign hits from pools for both sides */
  assignHits(): CombatState {
    const { state: afterAbilities } = runAbilities(
      'BEFORE_ASSIGN_HITS',
      this.data,
    )

    const tempState = CombatState.fromData(afterAbilities)
    const attackerParticipating = tempState.getParticipatingUnits('attacker')
    const defenderParticipating = tempState.getParticipatingUnits('defender')
    const attackerPriority = tempState.getUnitPriority('attacker')
    const defenderPriority = tempState.getUnitPriority('defender')

    let resultData = assignHitsSide(
      afterAbilities,
      'attacker',
      attackerParticipating,
      attackerPriority,
    )
    resultData = assignHitsSide(
      resultData,
      'defender',
      defenderParticipating,
      defenderPriority,
    )

    return CombatState.fromData(resultData)
  }

  /** Check if combat is finished (one or both sides' participating units eliminated) */
  isFinished(): boolean {
    const attackerParticipating = this.getParticipatingUnits('attacker')
    const defenderParticipating = this.getParticipatingUnits('defender')
    const attackerAlive = countUnits(this.attacker, attackerParticipating) > 0
    const defenderAlive = countUnits(this.defender, defenderParticipating) > 0
    return !attackerAlive || !defenderAlive
  }

  /** Generate a hash for state comparison and caching */
  getHash(): string {
    return `${getSideHash(this.attacker)}|${getSideHash(this.defender)}`
  }

  /** Run SETUP abilities */
  runSetup(): CombatState {
    const { state: newData } = runAbilities('SETUP', this.data)
    return CombatState.fromData(newData)
  }
}

function getSideHash(side: SideState): string {
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

// Re-export types and utilities
export type { CombatSide, CombatStateData, SideState }
export { getOpponentSide }
