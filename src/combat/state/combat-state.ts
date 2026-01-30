import type { DieValue, UnitType } from '@/types'

import {
  getAbilityParams,
  runAbilities,
  type RunAbilitiesResult,
  type SidedDiceData,
} from '../abilities'
import type {
  AbilityTiming,
  DicePool,
  TimingContextMap,
} from '../abilities/types'
import { getCombinedDiceDistribution } from '../dice'
import type { LogEntry } from '../types'
import {
  getFirstMicroPhase,
  getInitialPhaseIdentifier,
  getLastMicroPhase,
  getNextMetaPhase,
  getNextMicroPhase,
  getPhaseKey,
  isLastMicroPhase,
} from './phase-utils'
import {
  addHits,
  assignHits as assignHitsSide,
  collectDice,
  countUnits,
  getDestroyedUnits,
} from './side-state-ops'
import type {
  AbilitiesConfig,
  CombatMode,
  CombatSide,
  CombatStateData,
  HitSource,
  PhaseIdentifier,
  SideState,
} from './types'

/** A state with its probability and log entries */
export interface StateWithProbability {
  state: CombatState
  probability: number
  log?: LogEntry[]
}

interface UnitAbilityPhaseConfig {
  firing: CombatSide[]
  hitSource: HitSource
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

/** Get participating units from SETTINGS ability for a given state */
function getParticipatingUnitsFromData(
  data: CombatStateData,
  side: CombatSide,
): ReadonlySet<UnitType> {
  const params = getAbilityParams(data.abilities, side, 'SETTINGS')
  if (!params) {
    // Fallback: all units with count > 0 are participating
    return new Set(Object.keys(data[side].units) as UnitType[])
  }

  // Select units based on combat mode
  const units =
    data.combatMode === 'GROUND'
      ? (params.groundCombatParticipating as UnitType[])
      : (params.spaceCombatParticipating as UnitType[])

  return new Set(units)
}

/** Flatten a DicePool into DieValue[] for probability calculation */
function flattenDicePool(pool: DicePool): DieValue[] {
  const result: DieValue[] = []

  for (const [type, units] of Object.entries(pool)) {
    if (!units || units.length === 0) continue
    const unitType = type as UnitType

    // Group by hitValue for efficiency
    const grouped = new Map<number, number>()
    for (const [hitValue, diceCount] of units) {
      grouped.set(hitValue, (grouped.get(hitValue) ?? 0) + diceCount)
    }

    for (const [hitValue, totalDice] of grouped) {
      result.push([hitValue, totalDice, unitType])
    }
  }

  return result
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

  get combatMode(): CombatMode {
    return this.data.combatMode
  }

  get currentPhase(): PhaseIdentifier {
    return this.data.currentPhase
  }

  constructor(
    attacker: SideState,
    defender: SideState,
    abilities: AbilitiesConfig,
    combatMode: CombatMode,
    currentPhase?: PhaseIdentifier,
  ) {
    this.data = {
      attacker,
      defender,
      abilities,
      combatMode,
      currentPhase: currentPhase ?? getInitialPhaseIdentifier(combatMode),
    }

    // PREPARE runs on the full state (no participating-unit filter)
    // so abilities like Planetary Shield can see all units (e.g. PDS)
    const prepareTimings =
      combatMode === 'SPACE'
        ? (['PREPARE', 'PREPARE_SPACE'] as const)
        : (['PREPARE', 'PREPARE_GROUND'] as const)
    const { state: newData } = runAbilities([...prepareTimings], this.data)

    this.data = newData
  }

  private static fromData(data: CombatStateData): CombatState {
    const instance = Object.create(CombatState.prototype) as CombatState
    ;(instance as { data: CombatStateData }).data = data
    return instance
  }

  /** Collect dice for a side and source */
  collectDice(side: CombatSide, source: HitSource): DicePool {
    const participatingUnits = this.getParticipatingUnits(side)
    return collectDice(this[side], source, participatingUnits)
  }

  /** Get participating units from SETTINGS ability */
  getParticipatingUnits(side: CombatSide): ReadonlySet<UnitType> {
    return getParticipatingUnitsFromData(this.data, side)
  }

  /** Get valid targets for the current phase from SETTINGS ability */
  private getValidTargetsForPhase(): UnitType[] {
    const params = getAbilityParams(this.abilities, 'attacker', 'SETTINGS')
    if (!params) return []

    switch (this.currentPhase.meta) {
      case 'SPACE_CANNON_OFFENSE':
        return (params.validTargetsSpaceCannonOffense as UnitType[]) ?? []
      case 'AFB':
        return (params.validTargetsAntiFighterBarrage as UnitType[]) ?? []
      case 'BOMBARDMENT':
        return (params.validTargetsBombardment as UnitType[]) ?? []
      case 'SPACE_CANNON_DEFENSE':
        return (params.validTargetsSpaceCannonDefense as UnitType[]) ?? []
      default:
        return []
    }
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
  private runAbilities<T extends AbilityTiming>(
    timing: T | T[],
    context?: TimingContextMap[T],
    stateData: CombatStateData = this.data,
  ): RunAbilitiesResult<T> {
    const attackerParticipating = getParticipatingUnitsFromData(
      stateData,
      'attacker',
    )
    const defenderParticipating = getParticipatingUnitsFromData(
      stateData,
      'defender',
    )

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
      log: result.log,
    }
  }

  assignHits(): CombatState {
    return this.assignHitsInternal().state
  }

  private assignHitsInternal(): { state: CombatState; log: LogEntry[] } {
    const { state: afterAbilities, log: beforeLog } =
      this.runAbilities('BEFORE_ASSIGN_HITS')

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

    const destroyedContext = {
      attacker: getDestroyedUnits(
        afterAbilities.attacker.units,
        resultData.attacker.units,
      ),
      defender: getDestroyedUnits(
        afterAbilities.defender.units,
        resultData.defender.units,
      ),
    }

    const log: LogEntry[] = [...beforeLog]

    if (
      destroyedContext.attacker.length === 0 &&
      destroyedContext.defender.length === 0
    ) {
      return { state: CombatState.fromData(resultData), log }
    }

    const { state: afterDestroy, log: afterDestroyLog } = this.runAbilities(
      'AFTER_DESTROY',
      destroyedContext,
      resultData,
    )

    log.push(...afterDestroyLog)

    return { state: CombatState.fromData(afterDestroy), log }
  }

  isFinished(): boolean {
    const { meta, micro } = this.currentPhase

    if (meta === 'COMPLETE') {
      return true
    }

    // END micro-phase must always process so END_OF_COMBAT_ROUND/END_OF_COMBAT abilities fire
    if (
      micro === 'END' &&
      (meta === 'SPACE_COMBAT' || meta === 'GROUND_COMBAT')
    ) {
      return false
    }

    // Count total units (all types) and participating units
    const attackerTotalUnits = countUnits(this.attacker)
    const defenderTotalUnits = countUnits(this.defender)

    // If either side has NO units at all, combat is finished
    if (attackerTotalUnits === 0 || defenderTotalUnits === 0) {
      return true
    }

    // During combat phases, check if either side has no participating units
    if (meta === 'SPACE_COMBAT' || meta === 'GROUND_COMBAT') {
      const attackerParticipating = this.getParticipatingUnits('attacker')
      const defenderParticipating = this.getParticipatingUnits('defender')
      const attackerHasParticipating =
        countUnits(this.attacker, attackerParticipating) > 0
      const defenderHasParticipating =
        countUnits(this.defender, defenderParticipating) > 0

      if (!attackerHasParticipating || !defenderHasParticipating) {
        return true
      }
    }

    return false
  }

  getHash(): string {
    const phaseHash = getPhaseKey(this.currentPhase)
    return `${phaseHash}|${getSideHash(this.attacker)}|${getSideHash(this.defender)}|${getAbilitiesHash(this.abilities)}`
  }

  /**
   * Advance using the two-tier phase system.
   * Handles meta-phase routing to appropriate processing methods.
   */
  public advance(round: number): StateWithProbability[] {
    const { meta } = this.currentPhase

    switch (meta) {
      case 'SPACE_CANNON_OFFENSE':
        return this.advanceUnitAbilityPhase({
          firing: ['attacker', 'defender'],
          hitSource: 'SPACE_CANNON',
        })

      case 'AFB':
        return this.advanceUnitAbilityPhase({
          firing: ['attacker', 'defender'],
          hitSource: 'AFB',
        })

      case 'SPACE_COMBAT':
      case 'GROUND_COMBAT':
        return this.advanceCombatPhase(round)

      case 'BOMBARDMENT':
        return this.advanceUnitAbilityPhase({
          firing: ['attacker'],
          hitSource: 'BOMBARDMENT',
        })

      case 'SPACE_CANNON_DEFENSE':
        return this.advanceUnitAbilityPhase({
          firing: ['defender'],
          hitSource: 'SPACE_CANNON',
        })

      case 'COMPLETE':
        return [{ state: this, probability: 1 }]
    }
  }

  private advanceCombatPhase(round: number): StateWithProbability[] {
    const micro = this.currentPhase.micro

    switch (micro) {
      case 'START':
        return this.processStartOfRound(round)
      case 'DICE_ROLL':
        return this.processDiceRoll()
      case 'ASSIGN_HITS':
        return this.processAssignHits()
      case 'END':
        return this.processEndOfRound()
      default:
        return this.transitionPhase()
    }
  }

  private rollDiceOutcomes(
    stateData: CombatStateData,
    modifiedDice: SidedDiceData,
    validTargets: UnitType[],
    prependLog?: LogEntry[],
  ): StateWithProbability[] {
    const attackerDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.attacker),
    )
    const defenderDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.defender),
    )
    const { meta: metaPhase } = this.currentPhase

    const results: StateWithProbability[] = []

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        // Cross-assignment: attacker hits -> defender, defender hits -> attacker
        let resultData = addHits(
          stateData,
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

        const log: LogEntry[] = [...(prependLog ?? [])]
        log.push([metaPhase, 'DICE_ROLL', 'attacker', attOutcome.hits])
        log.push([metaPhase, 'DICE_ROLL', 'defender', defOutcome.hits])

        const nextState = this.transitionPhaseWithData(resultData, log)

        results.push({
          state: nextState[0].state,
          probability,
          log: nextState[0].log,
        })
      }
    }

    return results
  }

  /**
   * Transition to the next phase (micro or meta as appropriate).
   * If at END micro-phase, transitions to next meta-phase.
   * Otherwise, transitions to next micro-phase.
   */
  private transitionPhase(): StateWithProbability[] {
    return this.transitionPhaseWithData(this.data)
  }

  private transitionPhaseWithData(
    data: CombatStateData,
    log?: LogEntry[],
  ): StateWithProbability[] {
    // At last micro-phase, transition to next meta-phase
    if (isLastMicroPhase(this.currentPhase)) {
      const { phase } = getNextMetaPhase(this.currentPhase, this.combatMode)

      // Check if we should skip to COMPLETE due to one side having no combat units
      let finalPhase = phase
      const tempState = CombatState.fromData({ ...data, currentPhase: phase })

      if (tempState.isFinished()) {
        finalPhase = {
          meta: 'COMPLETE',
          micro: getLastMicroPhase('COMPLETE'),
        }
      }

      const nextState = CombatState.fromData({
        ...data,
        currentPhase: finalPhase,
      })
      return [{ state: nextState, probability: 1, log }]
    }

    // Otherwise, transition to next micro-phase
    const { phase } = getNextMicroPhase(this.currentPhase)
    const nextState = CombatState.fromData({ ...data, currentPhase: phase })
    return [{ state: nextState, probability: 1, log }]
  }

  // ===========================================================================
  // UNIT ABILITY PHASE PROCESSING (Space Cannon, Bombardment)
  // ===========================================================================

  private advanceUnitAbilityPhase(
    config: UnitAbilityPhaseConfig,
  ): StateWithProbability[] {
    const micro = this.currentPhase.micro

    switch (micro) {
      case 'DICE_ROLL':
        return this.processUnitAbilityDiceRoll(config)
      case 'ASSIGN_HITS':
        return this.processAssignHits()
      default:
        throw new Error(`Incorrect micro phase: ${micro}`)
    }
  }

  /** Process dice roll for unit ability phases */
  private processUnitAbilityDiceRoll(
    config: UnitAbilityPhaseConfig,
  ): StateWithProbability[] {
    const { firing, hitSource } = config

    // Collect dice based on firing configuration
    const attackerDice = firing.includes('attacker')
      ? this.collectDice('attacker', hitSource)
      : {}
    const defenderDice = firing.includes('defender')
      ? this.collectDice('defender', hitSource)
      : {}

    const sidedDiceData: SidedDiceData = {
      attacker: attackerDice,
      defender: defenderDice,
    }

    // All unit ability timings use SidedDiceData context
    const {
      state: afterWhen,
      context: modifiedDice,
      log: abilityLog,
    } = this.runAbilities('BEFORE_UNIT_ABILITY_ROLL', sidedDiceData) as {
      state: CombatStateData
      context: SidedDiceData
      log: LogEntry[]
    }

    return this.rollDiceOutcomes(
      afterWhen,
      modifiedDice,
      this.getValidTargetsForPhase(),
      abilityLog.length > 0 ? abilityLog : undefined,
    )
  }

  // ===========================================================================
  // COMBAT PHASE PROCESSING (shared by SPACE_COMBAT and GROUND_COMBAT)
  // ===========================================================================

  /**
   * Process start of combat round.
   * In round 1, START_OF_COMBAT and START_OF_COMBAT_ROUND share a timing window.
   * In round 1 of SPACE_COMBAT, transitions to AFB meta-phase instead of DICE_ROLL.
   */
  private processStartOfRound(round: number): StateWithProbability[] {
    const timings =
      round === 1
        ? (['START_OF_COMBAT_ROUND', 'START_OF_COMBAT'] as const)
        : (['START_OF_COMBAT_ROUND'] as const)
    const { state: newData, log } = this.runAbilities([...timings])

    // In round 1 of SPACE_COMBAT, transition to AFB meta-phase
    if (round === 1 && this.currentPhase.meta === 'SPACE_COMBAT') {
      const nextState = CombatState.fromData({
        ...newData,
        currentPhase: { meta: 'AFB', micro: getFirstMicroPhase('AFB') },
      })
      return [
        {
          state: nextState,
          probability: 1,
          log: log.length > 0 ? log : undefined,
        },
      ]
    }

    return this.transitionPhaseWithData(
      newData,
      log.length > 0 ? log : undefined,
    )
  }

  private processDiceRoll(): StateWithProbability[] {
    const attackerDice = this.collectDice('attacker', 'COMBAT')
    const defenderDice = this.collectDice('defender', 'COMBAT')

    const sidedDiceData: SidedDiceData = {
      attacker: attackerDice,
      defender: defenderDice,
    }

    const {
      state: afterWhen,
      context: modifiedDice,
      log: abilityLog,
    } = this.runAbilities('BEFORE_DICE_ROLL', sidedDiceData)

    return this.rollDiceOutcomes(
      afterWhen,
      modifiedDice,
      this.getValidTargetsForPhase(),
      abilityLog.length > 0 ? abilityLog : undefined,
    )
  }

  private processAssignHits(): StateWithProbability[] {
    const { state: afterAssign, log } = this.assignHitsInternal()

    return this.transitionPhaseWithData(
      afterAssign.data,
      log.length > 0 ? log : undefined,
    )
  }

  private processEndOfRound(): StateWithProbability[] {
    const timings = this.isLastRound()
      ? (['END_OF_COMBAT_ROUND', 'END_OF_COMBAT'] as const)
      : (['END_OF_COMBAT_ROUND'] as const)
    const { state: newData, log } = this.runAbilities([...timings])

    return this.transitionPhaseWithData(
      newData,
      log.length > 0 ? log : undefined,
    )
  }

  /** Check if this is the last round (one side has 0 participating units) */
  private isLastRound(): boolean {
    const attackerParticipating = this.getParticipatingUnits('attacker')
    const defenderParticipating = this.getParticipatingUnits('defender')
    const attackerHasParticipating =
      countUnits(this.attacker, attackerParticipating) > 0
    const defenderHasParticipating =
      countUnits(this.defender, defenderParticipating) > 0

    return !attackerHasParticipating || !defenderHasParticipating
  }
}

function getAbilitiesHash(abilities: AbilitiesConfig): string {
  const hashSide = (side: AbilitiesConfig[keyof AbilitiesConfig]) => {
    if (!side.config) return ''
    const keys = Object.keys(side.config).sort()
    return keys.map(k => `${k}:${JSON.stringify(side.config![k])}`).join(',')
  }
  const a = hashSide(abilities.attacker)
  const d = hashSide(abilities.defender)
  if (!a && !d) return ''
  return `a{${a}}d{${d}}`
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

  // Include unit ability restrictions in hash
  if (side.unitAbilityRestrictions) {
    const r = side.unitAbilityRestrictions
    for (const layer of ['lost', 'cannotBeUsed'] as const) {
      const layerData = r[layer]
      if (!layerData) continue
      const keys = Object.keys(layerData).sort()
      for (const key of keys) {
        const entries = layerData[key as keyof typeof layerData]
        if (!entries || entries.length === 0) continue
        const entriesHash = entries
          .map(e => `${e.reason}${e.unitType ? `:${e.unitType}` : ''}`)
          .sort()
          .join(';')
        parts.push(`${layer}.${key}:[${entriesHash}]`)
      }
    }
  }

  return parts.join(',')
}
