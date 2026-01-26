import type { DieValue, UnitType } from '@/types'

import {
  getAbilityParams,
  runAbilities,
  type SidedDiceData,
} from '../abilities'
import { getCombinedDiceDistribution } from '../dice'
import { getInitialPhase, getNextPhase } from './phase-utils'
import {
  addHits,
  assignHits as assignHitsSide,
  collectDice,
  countUnits,
  getOpponentSide,
} from './side-state-ops'
import type {
  AbilitiesConfig,
  CombatPhase,
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
  get phase(): CombatPhase {
    return this.data.phase
  }

  constructor(
    attacker: SideState,
    defender: SideState,
    abilities?: AbilitiesConfig,
    phase?: CombatPhase,
  ) {
    this.data = {
      attacker,
      defender,
      abilities: abilities ?? EMPTY_ABILITIES,
      phase: phase ?? getInitialPhase(),
    }
  }

  private static fromData(data: CombatStateData): CombatState {
    return new CombatState(
      data.attacker,
      data.defender,
      data.abilities,
      data.phase,
    )
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
    return `${this.phase}|${getSideHash(this.attacker)}|${getSideHash(this.defender)}`
  }

  /** Run SETUP abilities */
  runSetup(): CombatState {
    const { state: newData } = runAbilities('SETUP', this.data)
    return CombatState.fromData(newData)
  }

  /**
   * Advance the combat state by one phase.
   * Returns all possible outcomes with their probabilities.
   * @param round Current round number (used for AFB phase skipping on round > 1)
   */
  advance(round: number = 1): StateWithProbability[] {
    switch (this.phase) {
      case 'START_OF_ROUND':
        return this.processStartOfRound(round)
      case 'AFB_ROLL':
        return this.processAfbRoll(round)
      case 'AFB_ASSIGN_HITS':
        return this.processAfbAssignHits(round)
      case 'DICE_ROLL':
        return this.processDiceRoll(round)
      case 'ASSIGN_HITS':
        return this.processAssignHits(round)
      case 'END_OF_ROUND':
        return this.processEndOfRound()
      case 'AFTER_ROUND':
        return this.processAfterRound()
    }
  }

  /** Transition to the next phase, creating a new state */
  private transitionToNextPhase(
    data: CombatStateData,
    round: number,
  ): CombatState {
    const { phase } = getNextPhase(data.phase, round)
    return CombatState.fromData({ ...data, phase })
  }

  /** Process START_OF_ROUND phase - triggers START_OF_ROUND abilities */
  private processStartOfRound(round: number): StateWithProbability[] {
    const { state: newData } = runAbilities('START_OF_ROUND', this.data)
    const nextState = this.transitionToNextPhase(newData, round)
    return [{ state: nextState, probability: 1 }]
  }

  /** Process AFB_ROLL phase - collect dice, run abilities, branch on outcomes */
  private processAfbRoll(round: number): StateWithProbability[] {
    const attackerDice = this.collectDice('attacker', 'AFB')
    const defenderDice = this.collectDice('defender', 'AFB')

    const sidedDiceData: SidedDiceData = {
      attacker: [...attackerDice],
      defender: [...defenderDice],
    }

    // Run BEFORE_AFB_ROLL abilities
    const { state: afterBefore, context: beforeDice } = runAbilities(
      'BEFORE_AFB_ROLL',
      this.data,
      sidedDiceData,
    )

    // Run WHEN_AFB_ROLL abilities (can modify dice)
    const { state: afterWhen, context: modifiedDice } = runAbilities(
      'WHEN_AFB_ROLL',
      afterBefore,
      beforeDice,
    )

    const attackerDist = getCombinedDiceDistribution(modifiedDice.attacker)
    const defenderDist = getCombinedDiceDistribution(modifiedDice.defender)
    const validTargets = getValidTargets('AFB')

    const results: StateWithProbability[] = []

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        // Attacker hits go to defender, defender hits go to attacker
        let resultData = addHits(
          afterWhen,
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

        const nextState = this.transitionToNextPhase(resultData, round)
        results.push({
          state: nextState,
          probability,
          meta: { attacker: defOutcome.hits, defender: attOutcome.hits },
        })
      }
    }

    return results
  }

  /** Process AFB_ASSIGN_HITS phase - assign AFB hits */
  private processAfbAssignHits(round: number): StateWithProbability[] {
    const afterAssign = this.assignHits()
    const nextState = this.transitionToNextPhase(afterAssign.data, round)
    return [{ state: nextState, probability: 1 }]
  }

  /** Process DICE_ROLL phase - collect dice, run abilities, branch on outcomes */
  private processDiceRoll(round: number): StateWithProbability[] {
    const attackerDice = this.collectDice('attacker', 'COMBAT')
    const defenderDice = this.collectDice('defender', 'COMBAT')

    const sidedDiceData: SidedDiceData = {
      attacker: [...attackerDice],
      defender: [...defenderDice],
    }

    // Run BEFORE_DICE_ROLL abilities
    const { state: afterBefore, context: beforeDice } = runAbilities(
      'BEFORE_DICE_ROLL',
      this.data,
      sidedDiceData,
    )

    // Run WHEN_DICE_ROLL abilities (can modify dice)
    const { state: afterWhen, context: modifiedDice } = runAbilities(
      'WHEN_DICE_ROLL',
      afterBefore,
      beforeDice,
    )

    const attackerDist = getCombinedDiceDistribution(modifiedDice.attacker)
    const defenderDist = getCombinedDiceDistribution(modifiedDice.defender)
    const validTargets = getValidTargets('COMBAT')

    const results: StateWithProbability[] = []

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        // Attacker hits go to defender, defender hits go to attacker
        let resultData = addHits(
          afterWhen,
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

        const nextState = this.transitionToNextPhase(resultData, round)

        results.push({
          state: nextState,
          probability,
          meta: { attacker: defOutcome.hits, defender: attOutcome.hits },
        })
      }
    }

    return results
  }

  /** Process ASSIGN_HITS phase - assign combat hits */
  private processAssignHits(round: number): StateWithProbability[] {
    const afterAssign = this.assignHits()
    const nextState = this.transitionToNextPhase(afterAssign.data, round)
    return [{ state: nextState, probability: 1 }]
  }

  /** Process END_OF_ROUND phase - triggers END_OF_ROUND abilities */
  private processEndOfRound(): StateWithProbability[] {
    const { state: newData } = runAbilities('END_OF_ROUND', this.data)
    // Round doesn't matter for END_OF_ROUND -> AFTER_ROUND transition
    const nextState = this.transitionToNextPhase(newData, 1)
    return [{ state: nextState, probability: 1 }]
  }

  /** Process AFTER_ROUND phase - triggers AFTER_ROUND abilities */
  private processAfterRound(): StateWithProbability[] {
    const { state: newData } = runAbilities('AFTER_ROUND', this.data)
    // Round doesn't matter for AFTER_ROUND -> START_OF_ROUND transition
    const nextState = this.transitionToNextPhase(newData, 1)
    return [{ state: nextState, probability: 1 }]
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

  // Include hitPools in hash
  if (side.hitPools.length > 0) {
    const poolsHash = side.hitPools
      .map(p => `${p.hits}:${[...p.validTargets].sort().join('+')}`)
      .join(';')
    parts.push(`pools:[${poolsHash}]`)
  }

  return parts.join(',')
}

// Re-export types and utilities
export type { CombatSide, CombatStateData, SideState }
export { getOpponentSide }
