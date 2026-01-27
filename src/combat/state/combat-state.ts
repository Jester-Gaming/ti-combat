import type { DieValue, UnitType } from '@/types'

import {
  getAbilityParams,
  runAbilities,
  type RunAbilitiesResult,
  type SidedDiceData,
} from '../abilities'
import type { AbilityTiming, TimingContextMap } from '../abilities/types'
import { getCombinedDiceDistribution } from '../dice'
import {
  getInitialPhase,
  getNextPhase,
  getNextPhaseIdentifier,
  getPhaseKey,
} from './phase-utils'
import {
  addHits,
  assignHits as assignHitsSide,
  collectDice,
  countUnits,
  getOpponentSide,
} from './side-state-ops'
import type {
  AbilitiesConfig,
  CombatMode,
  CombatPhase,
  CombatSide,
  CombatStateData,
  PhaseIdentifier,
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

/** Filter side state to only include participating unit types */
function filterSideUnits(
  side: SideState,
  participating: ReadonlySet<UnitType>,
): SideState {
  const filteredUnits: SideState['units'] = {}
  for (const [type, units] of Object.entries(side.units)) {
    if (participating.has(type as UnitType) && units) {
      filteredUnits[type as UnitType] = units
    }
  }
  return { ...side, units: filteredUnits }
}

/** Filter state to only include participating units for abilities */
function filterToParticipating(
  data: CombatStateData,
  attackerParticipating: ReadonlySet<UnitType>,
  defenderParticipating: ReadonlySet<UnitType>,
): CombatStateData {
  return {
    ...data,
    attacker: filterSideUnits(data.attacker, attackerParticipating),
    defender: filterSideUnits(data.defender, defenderParticipating),
  }
}

/** Merge side with non-participating units from original */
function mergeSideUnits(
  resultSide: SideState,
  originalSide: SideState,
  participating: ReadonlySet<UnitType>,
): SideState {
  const mergedUnits: SideState['units'] = { ...resultSide.units }
  // Add back non-participating units from original
  for (const [type, units] of Object.entries(originalSide.units)) {
    if (!participating.has(type as UnitType) && units) {
      mergedUnits[type as UnitType] = units
    }
  }
  return { ...resultSide, units: mergedUnits }
}

/** Merge ability results back with non-participating units */
function mergeWithNonParticipating(
  resultData: CombatStateData,
  originalData: CombatStateData,
  attackerParticipating: ReadonlySet<UnitType>,
  defenderParticipating: ReadonlySet<UnitType>,
): CombatStateData {
  return {
    ...resultData,
    attacker: mergeSideUnits(
      resultData.attacker,
      originalData.attacker,
      attackerParticipating,
    ),
    defender: mergeSideUnits(
      resultData.defender,
      originalData.defender,
      defenderParticipating,
    ),
  }
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

  get combatMode(): CombatMode | undefined {
    return this.data.combatMode
  }

  get currentPhase(): PhaseIdentifier | undefined {
    return this.data.currentPhase
  }

  constructor(
    attacker: SideState,
    defender: SideState,
    abilities?: AbilitiesConfig,
    phase?: CombatPhase,
    combatMode?: CombatMode,
    currentPhase?: PhaseIdentifier,
  ) {
    this.data = {
      attacker,
      defender,
      abilities: abilities ?? EMPTY_ABILITIES,
      phase: phase ?? getInitialPhase(),
      combatMode,
      currentPhase,
    }
  }

  private static fromData(data: CombatStateData): CombatState {
    return new CombatState(
      data.attacker,
      data.defender,
      data.abilities,
      data.phase,
      data.combatMode,
      data.currentPhase,
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

    // Select units based on combat mode
    const units =
      this.combatMode === 'GROUND'
        ? (params.ground as UnitType[])
        : (params.space as UnitType[])

    return new Set(units)
  }

  /** Get unit priority from UNIT_PRIORITY ability if present */
  private getUnitPriority(side: CombatSide): UnitType[] | undefined {
    const params = getAbilityParams(this.abilities, side, 'UNIT_PRIORITY')
    if (!params) return undefined
    return params.unitPriority as UnitType[] | undefined
  }

  /**
   * Run abilities with filtering to only participating units.
   * Non-participating units are hidden from abilities, then merged back.
   * @param timing - The ability timing to run
   * @param context - Optional timing context (e.g., dice data)
   * @param stateData - State to run abilities on (defaults to this.data)
   */
  private runAbilitiesFiltered<T extends AbilityTiming>(
    timing: T,
    context?: TimingContextMap[T],
    stateData: CombatStateData = this.data,
  ): RunAbilitiesResult<T> {
    const attackerParticipating = this.getParticipatingUnits('attacker')
    const defenderParticipating = this.getParticipatingUnits('defender')

    // Filter state to only participating units
    const filteredData = filterToParticipating(
      stateData,
      attackerParticipating,
      defenderParticipating,
    )

    // Run abilities on filtered state
    const result = runAbilities(timing, filteredData, context)

    // Merge non-participating units back from the original filtered state
    const mergedState = mergeWithNonParticipating(
      result.state,
      stateData,
      attackerParticipating,
      defenderParticipating,
    )

    return {
      state: mergedState,
      context: result.context,
    }
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

    const { state: newStateData, context: modifiedDice } =
      this.runAbilitiesFiltered('BEFORE_DICE_ROLL', sidedDiceData)

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
    const { state: afterAbilities } =
      this.runAbilitiesFiltered('BEFORE_ASSIGN_HITS')

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
    // Include two-tier phase if available, otherwise fall back to legacy phase
    const phaseHash = this.currentPhase
      ? getPhaseKey(this.currentPhase)
      : this.phase
    return `${phaseHash}|${getSideHash(this.attacker)}|${getSideHash(this.defender)}`
  }

  /**
   * Transition to the next phase using the two-tier system.
   * This is a forward-looking method that will be used once the combat engine
   * is updated to use the two-tier system.
   */
  transitionPhase(): CombatState {
    if (!this.combatMode || !this.currentPhase) {
      throw new Error(
        'Two-tier phase system not initialized. Set combatMode and currentPhase.',
      )
    }

    const { phase: nextPhase } = getNextPhaseIdentifier(
      this.currentPhase,
      this.combatMode,
    )

    return CombatState.fromData({
      ...this.data,
      currentPhase: nextPhase,
    })
  }

  /**
   * Check if combat has reached the COMPLETE meta-phase.
   * For two-tier system usage.
   */
  isComplete(): boolean {
    return this.currentPhase?.meta === 'COMPLETE'
  }

  /** Run SETUP abilities */
  runSetup(): CombatState {
    const { state: newData } = this.runAbilitiesFiltered('SETUP')
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
    const { state: newData } = this.runAbilitiesFiltered('START_OF_ROUND')
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
    const { state: afterBefore, context: beforeDice } =
      this.runAbilitiesFiltered('BEFORE_AFB_ROLL', sidedDiceData)

    // Run WHEN_AFB_ROLL abilities (can modify dice)
    const { state: afterWhen, context: modifiedDice } =
      this.runAbilitiesFiltered('WHEN_AFB_ROLL', beforeDice, afterBefore)

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
    const { state: afterBefore, context: beforeDice } =
      this.runAbilitiesFiltered('BEFORE_DICE_ROLL', sidedDiceData)

    // Run WHEN_DICE_ROLL abilities (can modify dice)
    const { state: afterWhen, context: modifiedDice } =
      this.runAbilitiesFiltered('WHEN_DICE_ROLL', beforeDice, afterBefore)

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
    const { state: newData } = this.runAbilitiesFiltered('END_OF_ROUND')
    // Round doesn't matter for END_OF_ROUND -> AFTER_ROUND transition
    const nextState = this.transitionToNextPhase(newData, 1)
    return [{ state: nextState, probability: 1 }]
  }

  /** Process AFTER_ROUND phase - triggers AFTER_ROUND abilities */
  private processAfterRound(): StateWithProbability[] {
    const { state: newData } = this.runAbilitiesFiltered('AFTER_ROUND')
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
