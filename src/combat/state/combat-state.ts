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
  getNextMetaPhase,
  getNextMicroPhase,
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

  /**
   * Check if combat is finished.
   *
   * For two-tier system: During pre-combat phases (SPACE_CANNON_OFFENSE, BOMBARDMENT,
   * SPACE_CANNON_DEFENSE), combat is only "finished" if we've reached COMPLETE.
   * This ensures Space Cannon fires even if one side has no ships.
   *
   * For combat phases (SPACE_COMBAT, GROUND_COMBAT): Combat ends when one or both
   * sides have no participating units remaining.
   */
  isFinished(): boolean {
    // Two-tier system: check meta-phase for pre-combat handling
    if (this.currentPhase) {
      const { meta } = this.currentPhase

      // Pre-combat phases should complete even if one side has no combat units
      // (e.g., Space Cannon Offense should fire even if defender has only PDS)
      const isPreCombatPhase =
        meta === 'SPACE_CANNON_OFFENSE' ||
        meta === 'BOMBARDMENT' ||
        meta === 'SPACE_CANNON_DEFENSE'

      if (isPreCombatPhase) {
        return false // Never finish during pre-combat phases
      }

      // COMPLETE means combat is done
      if (meta === 'COMPLETE') {
        return true
      }
    }

    // Standard check: combat ends when either side has no participating units
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
    // Use two-tier system if currentPhase is set
    if (this.currentPhase) {
      return this.advanceTwoTier(round)
    }
    // Legacy system
    return this.advanceLegacy(round)
  }

  /**
   * Advance using the two-tier phase system.
   * Handles meta-phase routing to appropriate processing methods.
   */
  private advanceTwoTier(round: number): StateWithProbability[] {
    if (!this.currentPhase || !this.combatMode) {
      throw new Error('Two-tier phase system not initialized')
    }

    const { meta } = this.currentPhase

    switch (meta) {
      case 'SPACE_CANNON_OFFENSE':
        return this.advanceSpaceCannonOffense(round)

      case 'SPACE_COMBAT':
        return this.advanceSpaceCombat(round)

      case 'BOMBARDMENT':
        return this.advanceBombardment(round)

      case 'SPACE_CANNON_DEFENSE':
        return this.advanceSpaceCannonDefense(round)

      case 'GROUND_COMBAT':
        return this.advanceGroundCombat(round)

      case 'COMPLETE':
        // Combat finished - return self with probability 1
        return [{ state: this, probability: 1 }]

      default:
        // Unhandled meta-phase: fall back to legacy system
        // This allows incremental migration
        return this.advanceLegacy(round)
    }
  }

  /**
   * Advance Space Cannon Offense meta-phase through micro-phases.
   * Flow: START -> DICE_ROLL -> ASSIGN_HITS -> END
   * (AFB is skipped for non-SPACE_COMBAT meta-phases)
   */
  private advanceSpaceCannonOffense(round: number): StateWithProbability[] {
    const micro = this.currentPhase!.micro

    switch (micro) {
      case 'START':
        return this.transitionMicroPhase(round) // START -> DICE_ROLL (skips AFB)
      case 'DICE_ROLL':
        return this.processSpaceCannonOffense(round)
      case 'ASSIGN_HITS':
        return this.processSpaceCannonAssignHits(round)
      case 'END':
        return this.transitionMetaPhase()
      default:
        return this.transitionMicroPhase(round)
    }
  }

  /**
   * Advance Space Combat meta-phase through micro-phases.
   * Routes to existing combat methods via two-tier wrappers.
   * Flow: START -> AFB (round 1 only) -> DICE_ROLL -> ASSIGN_HITS -> END
   */
  private advanceSpaceCombat(round: number): StateWithProbability[] {
    const micro = this.currentPhase!.micro

    switch (micro) {
      case 'START':
        return this.processStartOfRoundTwoTier(round)
      case 'AFB':
        return this.processAfbRollTwoTier(round)
      case 'DICE_ROLL':
        return this.processDiceRollTwoTier(round)
      case 'ASSIGN_HITS':
        return this.processAssignHitsTwoTier(round)
      case 'END':
        return this.processEndOfRoundTwoTier()
      default:
        return this.transitionMicroPhase(round)
    }
  }

  /**
   * Legacy advance method - original switch statement.
   * Used when currentPhase is not set (backward compatibility).
   */
  private advanceLegacy(round: number): StateWithProbability[] {
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

  // ===========================================================================
  // TWO-TIER PHASE TRANSITION HELPERS
  // ===========================================================================

  /** Transition to the next micro-phase within the current meta-phase */
  private transitionMicroPhase(round: number): StateWithProbability[] {
    return this.transitionMicroPhaseWithData(this.data, round)
  }

  /** Transition to the next micro-phase with new state data */
  private transitionMicroPhaseWithData(
    data: CombatStateData,
    round: number,
  ): StateWithProbability[] {
    const { phase } = getNextMicroPhase(this.currentPhase!, round)
    const nextState = CombatState.fromData({ ...data, currentPhase: phase })
    return [{ state: nextState, probability: 1 }]
  }

  /** Transition to the next meta-phase (from END micro-phase) */
  private transitionMetaPhase(): StateWithProbability[] {
    return this.transitionMetaPhaseWithData(this.data)
  }

  /**
   * Transition to the next meta-phase with new state data.
   *
   * Before transitioning to a combat phase (SPACE_COMBAT, GROUND_COMBAT),
   * checks if both sides have participating units. If not, skips to COMPLETE.
   */
  private transitionMetaPhaseWithData(
    data: CombatStateData,
  ): StateWithProbability[] {
    const { phase } = getNextMetaPhase(this.currentPhase!, this.combatMode!)

    // Check if we should skip to COMPLETE due to one side having no combat units
    let finalPhase = phase
    if (phase.meta === 'SPACE_COMBAT' || phase.meta === 'GROUND_COMBAT') {
      // Create temporary state to check participating units with current data
      const tempState = CombatState.fromData({ ...data, currentPhase: phase })
      const attackerParticipating = tempState.getParticipatingUnits('attacker')
      const defenderParticipating = tempState.getParticipatingUnits('defender')
      const attackerHasUnits =
        countUnits(data.attacker, attackerParticipating) > 0
      const defenderHasUnits =
        countUnits(data.defender, defenderParticipating) > 0

      // If either side has no units for combat, skip to COMPLETE
      if (!attackerHasUnits || !defenderHasUnits) {
        finalPhase = { meta: 'COMPLETE', micro: 'END' }
      }
    }

    const nextState = CombatState.fromData({
      ...data,
      currentPhase: finalPhase,
    })
    // Note: incrementRound is returned but caller manages round counting
    return [{ state: nextState, probability: 1 }]
  }

  // ===========================================================================
  // SPACE CANNON OFFENSE PROCESSING
  // ===========================================================================

  /**
   * Process Space Cannon Offense phase - BIDIRECTIONAL fire.
   *
   * Both attacker AND defender fire at each other's ships before space combat.
   * This is different from Space Cannon Defense where only defender fires.
   *
   * NO skip logic - always process the phase even if no units have Space Cannon.
   * Abilities (BEFORE_SPACE_CANNON) may add dice even when initial arrays are empty.
   *
   * @param round Current combat round (always 1 for Space Cannon Offense)
   */
  private processSpaceCannonOffense(round: number): StateWithProbability[] {
    // Collect dice from BOTH sides - may be empty, that's OK
    const attackerDice = this.collectDice('attacker', 'SPACE_CANNON')
    const defenderDice = this.collectDice('defender', 'SPACE_CANNON')

    const sidedDiceData: SidedDiceData = {
      attacker: [...attackerDice],
      defender: [...defenderDice],
    }

    // Run BEFORE_SPACE_CANNON abilities (may add dice)
    const { state: afterBefore, context: beforeDice } =
      this.runAbilitiesFiltered('BEFORE_SPACE_CANNON', sidedDiceData)

    // Run WHEN_SPACE_CANNON abilities (can modify dice)
    const { state: afterWhen, context: modifiedDice } =
      this.runAbilitiesFiltered('WHEN_SPACE_CANNON', beforeDice, afterBefore)

    // Calculate probability distributions
    // Empty arrays produce a single outcome with 0 hits and probability 1
    const attackerDist = getCombinedDiceDistribution(modifiedDice.attacker)
    const defenderDist = getCombinedDiceDistribution(modifiedDice.defender)

    // Space Cannon Offense targets all ships (empty validTargets = all)
    const validTargets = getValidTargets('SPACE_CANNON')

    const results: StateWithProbability[] = []

    // Cross-product of outcomes for bidirectional fire
    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        // Cross-assignment: attacker hits -> defender's ships
        let resultData = addHits(
          afterWhen,
          'defender',
          attOutcome.hits,
          validTargets,
        )
        // Cross-assignment: defender hits -> attacker's ships
        resultData = addHits(
          resultData,
          'attacker',
          defOutcome.hits,
          validTargets,
        )

        // Transition to next micro-phase (ASSIGN_HITS)
        const nextState = this.transitionMicroPhaseWithData(resultData, round)

        results.push({
          state: nextState[0].state,
          probability,
          meta: { attacker: defOutcome.hits, defender: attOutcome.hits },
        })
      }
    }

    return results
  }

  /** Process Space Cannon hit assignment phase */
  private processSpaceCannonAssignHits(round: number): StateWithProbability[] {
    const afterAssign = this.assignHits()
    return this.transitionMicroPhaseWithData(afterAssign.data, round)
  }

  // ===========================================================================
  // BOMBARDMENT PROCESSING (GROUND COMBAT FLOW)
  // ===========================================================================

  /**
   * Advance Bombardment meta-phase through micro-phases.
   * Flow: START -> DICE_ROLL -> ASSIGN_HITS -> END
   * Only attacker fires (ships bombarding defender's ground forces).
   */
  private advanceBombardment(round: number): StateWithProbability[] {
    const micro = this.currentPhase!.micro

    switch (micro) {
      case 'START':
        return this.transitionMicroPhase(round) // START -> DICE_ROLL (skips AFB)
      case 'DICE_ROLL':
        return this.processBombardment(round)
      case 'ASSIGN_HITS':
        return this.processBombardmentAssignHits(round)
      case 'END':
        return this.transitionMetaPhase()
      default:
        return this.transitionMicroPhase(round)
    }
  }

  /**
   * Process Bombardment dice roll phase.
   * Only attacker fires at defender's ground forces.
   *
   * Bombardment is ONE-WAY: only attacker fires (ships bombarding planet).
   * Defender array stays empty unlike Space Cannon which is bidirectional.
   *
   * Ability hooks:
   * - BEFORE_BOMBARDMENT: May add dice (e.g., Plasma Scoring)
   * - WHEN_BOMBARDMENT: May modify dice
   */
  private processBombardment(round: number): StateWithProbability[] {
    // Only attacker has bombardment - defender doesn't fire back
    const attackerDice = this.collectDice('attacker', 'BOMBARDMENT')

    // Bombardment is ONE-WAY: only attacker fires, defender array is empty
    const sidedDiceData: SidedDiceData = {
      attacker: [...attackerDice],
      defender: [], // Empty - Bombardment is one-way (attacker only)
    }

    // Run BEFORE_BOMBARDMENT abilities (may add dice, e.g., Plasma Scoring)
    const { state: afterBefore, context: beforeDice } =
      this.runAbilitiesFiltered('BEFORE_BOMBARDMENT', sidedDiceData)

    // Run WHEN_BOMBARDMENT abilities (may modify dice)
    const { state: afterWhen, context: modifiedDice } =
      this.runAbilitiesFiltered('WHEN_BOMBARDMENT', beforeDice, afterBefore)

    const attackerDist = getCombinedDiceDistribution(modifiedDice.attacker)

    // Bombardment targets ground forces
    const validTargets = getValidTargets('BOMBARDMENT')

    const results: StateWithProbability[] = []

    for (const attOutcome of attackerDist) {
      const probability = attOutcome.probability
      if (probability === 0) continue

      // Attacker bombardment hits go to defender's ground forces
      const resultData = addHits(
        afterWhen,
        'defender',
        attOutcome.hits,
        validTargets,
      )

      const nextState = this.transitionMicroPhaseWithData(resultData, round)

      results.push({
        state: nextState[0].state,
        probability,
        meta: { attacker: 0, defender: attOutcome.hits },
      })
    }

    return results
  }

  /** Process Bombardment hit assignment phase */
  private processBombardmentAssignHits(round: number): StateWithProbability[] {
    const afterAssign = this.assignHits()
    return this.transitionMicroPhaseWithData(afterAssign.data, round)
  }

  // ===========================================================================
  // SPACE CANNON DEFENSE PROCESSING (GROUND COMBAT FLOW)
  // ===========================================================================

  /**
   * Advance Space Cannon Defense meta-phase through micro-phases.
   * Flow: START -> DICE_ROLL -> ASSIGN_HITS -> END
   * Only defender fires (PDS defending against invading ground forces).
   */
  private advanceSpaceCannonDefense(round: number): StateWithProbability[] {
    const micro = this.currentPhase!.micro

    switch (micro) {
      case 'START':
        return this.transitionMicroPhase(round) // START -> DICE_ROLL (skips AFB)
      case 'DICE_ROLL':
        return this.processSpaceCannonDefense(round)
      case 'ASSIGN_HITS':
        return this.processSpaceCannonDefenseAssignHits(round)
      case 'END':
        return this.transitionMetaPhase()
      default:
        return this.transitionMicroPhase(round)
    }
  }

  /**
   * Process Space Cannon Defense dice roll phase.
   * Only defender fires at attacker's invading ground forces.
   */
  private processSpaceCannonDefense(round: number): StateWithProbability[] {
    // Only defender has Space Cannon Defense - attacker doesn't fire back
    const defenderDice = this.collectDice('defender', 'SPACE_CANNON')

    const sidedDiceData: SidedDiceData = {
      attacker: [], // Attacker doesn't fire during Space Cannon Defense
      defender: [...defenderDice],
    }

    // Run BEFORE_SPACE_CANNON abilities (may add dice)
    const { state: afterBefore, context: beforeDice } =
      this.runAbilitiesFiltered('BEFORE_SPACE_CANNON', sidedDiceData)

    // Run WHEN_SPACE_CANNON abilities (can modify dice)
    const { state: afterWhen, context: modifiedDice } =
      this.runAbilitiesFiltered('WHEN_SPACE_CANNON', beforeDice, afterBefore)

    const defenderDist = getCombinedDiceDistribution(modifiedDice.defender)

    // Space Cannon Defense targets all units (ground forces in this case)
    const validTargets = getValidTargets('SPACE_CANNON')

    const results: StateWithProbability[] = []

    for (const defOutcome of defenderDist) {
      const probability = defOutcome.probability
      if (probability === 0) continue

      // Defender Space Cannon hits go to attacker's ground forces
      const resultData = addHits(
        afterWhen,
        'attacker',
        defOutcome.hits,
        validTargets,
      )

      const nextState = this.transitionMicroPhaseWithData(resultData, round)

      results.push({
        state: nextState[0].state,
        probability,
        meta: { attacker: defOutcome.hits, defender: 0 },
      })
    }

    return results
  }

  /** Process Space Cannon Defense hit assignment phase */
  private processSpaceCannonDefenseAssignHits(
    round: number,
  ): StateWithProbability[] {
    const afterAssign = this.assignHits()
    return this.transitionMicroPhaseWithData(afterAssign.data, round)
  }

  // ===========================================================================
  // GROUND COMBAT PROCESSING
  // ===========================================================================

  /**
   * Advance Ground Combat meta-phase through micro-phases.
   * Flow: START -> DICE_ROLL -> ASSIGN_HITS -> END (loops for multiple rounds)
   * Similar to Space Combat but without AFB.
   */
  private advanceGroundCombat(round: number): StateWithProbability[] {
    const micro = this.currentPhase!.micro

    switch (micro) {
      case 'START':
        return this.processStartOfRoundTwoTier(round)
      case 'DICE_ROLL':
        return this.processDiceRollTwoTier(round)
      case 'ASSIGN_HITS':
        return this.processAssignHitsTwoTier(round)
      case 'END':
        return this.processEndOfRoundTwoTier()
      default:
        return this.transitionMicroPhase(round)
    }
  }

  // ===========================================================================
  // TWO-TIER WRAPPER METHODS FOR SPACE COMBAT
  // ===========================================================================

  /** Process START_OF_ROUND for two-tier system */
  private processStartOfRoundTwoTier(round: number): StateWithProbability[] {
    const { state: newData } = this.runAbilitiesFiltered('START_OF_ROUND')
    return this.transitionMicroPhaseWithData(newData, round)
  }

  /** Process AFB_ROLL for two-tier system */
  private processAfbRollTwoTier(round: number): StateWithProbability[] {
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

        const nextState = this.transitionMicroPhaseWithData(resultData, round)
        results.push({
          state: nextState[0].state,
          probability,
          meta: { attacker: defOutcome.hits, defender: attOutcome.hits },
        })
      }
    }

    return results
  }

  /** Process DICE_ROLL for two-tier system */
  private processDiceRollTwoTier(round: number): StateWithProbability[] {
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

        const nextState = this.transitionMicroPhaseWithData(resultData, round)

        results.push({
          state: nextState[0].state,
          probability,
          meta: { attacker: defOutcome.hits, defender: attOutcome.hits },
        })
      }
    }

    return results
  }

  /** Process ASSIGN_HITS for two-tier system */
  private processAssignHitsTwoTier(round: number): StateWithProbability[] {
    const afterAssign = this.assignHits()
    return this.transitionMicroPhaseWithData(afterAssign.data, round)
  }

  /** Process END_OF_ROUND for two-tier system */
  private processEndOfRoundTwoTier(): StateWithProbability[] {
    const { state: newData } = this.runAbilitiesFiltered('END_OF_ROUND')
    // END micro-phase transitions to next meta-phase or loops for next round
    // getNextMetaPhase handles the loop back for combat phases
    return this.transitionMetaPhaseWithData(newData)
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
