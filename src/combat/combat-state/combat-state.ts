import { GROUND_FORCES, STRUCTURES } from '@/constants/units'
import factions from '@/data/faction'
import type { CombatSide, DiceGroup, FactionKey, UnitType } from '@/types'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

import {
  AbilitiesParams,
  type AbilityReadContext,
  type RunAbilitiesResult,
  type SidedDiceData,
} from '../abilities'
import { buildReadContext } from '../abilities/api/ability-api'
import type {
  AbilityTiming,
  DicePool,
  TimingContextMap,
} from '../abilities/types'
import {
  CombatSideState,
  createDefaultUnitSelections,
  destroyUnitsFromPool,
} from '../combat-side-state/combat-side-state'
import { getDestroyedUnits } from '../combat-side-state/utils/get-destroyed-units'
import { getSettingsValidTargets } from '../combat-side-state/utils/get-settings-valid-targets'
import { Logger } from '../logger'
import type { LogEntry } from '../types'
import { getCombinedDiceDistribution } from '../utils'
import { parseVariantId } from '../utils/unit-variant'
import {
  getFirstMicroPhase,
  getInitialPhaseIdentifier,
  getLastMicroPhase,
  getNextMetaPhase,
  getNextMicroPhase,
  isLastMicroPhase,
} from './phase-utils'
import type {
  AbilitiesConfig,
  CombatMode,
  CombatStateData,
  HitSource,
  PhaseIdentifier,
  SideStateData,
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
  allowedUnitTypes?: ReadonlySet<UnitType>
}

/** Flatten a DicePool into DiceGroup[] for probability calculation */
function flattenDicePool(pool: DicePool): DiceGroup[] {
  const result: DiceGroup[] = []

  for (const units of Object.values(pool)) {
    if (!units || units.length === 0) continue

    // Group by hitValue for efficiency
    const grouped = new Map<number, number>()
    for (const [hitValue, diceCount] of units) {
      grouped.set(hitValue, (grouped.get(hitValue) ?? 0) + diceCount)
    }

    for (const [hitValue, totalDice] of grouped) {
      result.push([hitValue, totalDice])
    }
  }

  return result
}

// Cache for getParticipatingUnits: source array → Set
const participatingUnitsCache = new WeakMap<UnitType[], ReadonlySet<UnitType>>()

/** Main combat state class */
export class CombatState {
  data: CombatStateData
  private _enableLog = false
  private _params!: AbilitiesParams
  private _attacker!: CombatSideState
  private _defender!: CombatSideState

  get disableAbilities() {
    return false
  }

  get attacker(): CombatSideState {
    return this._attacker
  }

  get defender(): CombatSideState {
    return this._defender
  }

  side(side: CombatSide): CombatSideState {
    return side === 'attacker' ? this._attacker : this._defender
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

  get params(): AbilitiesParams {
    return this._params
  }

  /** No-arg constructor with defaults (for UI state management) */
  constructor() {
    const defaultFaction = Object.keys(factions)[0] as FactionKey

    const defaultUnitStats = buildUnitStatsMap(defaultFaction)

    this.data = {
      attacker: {
        faction: defaultFaction,
        units: {},
        unitState: {},
        unitStats: defaultUnitStats,
        hitPools: [],
        unitSelections: createDefaultUnitSelections(),
      },
      defender: {
        faction: defaultFaction,
        units: {},
        unitState: {},
        unitStats: defaultUnitStats,
        hitPools: [],
        unitSelections: createDefaultUnitSelections(),
      },
      abilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
      currentPhase: getInitialPhaseIdentifier('SPACE'),
    }

    this._attacker = new CombatSideState(this, 'attacker')
    this._defender = new CombatSideState(this, 'defender')
    this._params = AbilitiesParams.fromConfig(this)
  }

  /** Create CombatState for simulation (replaces old parameterized constructor) */
  static forSimulation(
    attacker: SideStateData,
    defender: SideStateData,
    combatMode: CombatMode,
    abilitiesConfig?: AbilitiesConfig,
    currentPhase?: PhaseIdentifier,
  ): CombatState {
    const config = abilitiesConfig
      ? structuredClone(abilitiesConfig)
      : { attacker: {}, defender: {} }

    const instance = Object.create(CombatState.prototype) as CombatState

    // Phase 1: create data
    instance.data = {
      attacker,
      defender,
      abilities: config,
      combatMode,
      currentPhase: currentPhase ?? getInitialPhaseIdentifier(combatMode),
    }

    // Phase 2: create SideState instances and AbilitiesParams
    instance._attacker = new CombatSideState(instance, 'attacker')
    instance._defender = new CombatSideState(instance, 'defender')
    instance._params = AbilitiesParams.fromConfig(instance)

    // Phase 3: run PREPARE
    const { state: newData } = instance._params.runAbilities(
      'PREPARE',
      instance.data,
    )
    instance.data = newData

    return instance
  }

  public static fromData(
    data: CombatStateData,
    params?: AbilitiesParams,
  ): CombatState {
    const instance = Object.create(CombatState.prototype) as CombatState
    instance.data = data
    instance._attacker = new CombatSideState(instance, 'attacker')
    instance._defender = new CombatSideState(instance, 'defender')
    instance._params = params ?? AbilitiesParams.wrap(instance)
    return instance
  }

  /** Swap attacker and defender sides (for UI) */
  swap(): void {
    this.data = {
      ...this.data,
      attacker: this.data.defender,
      defender: this.data.attacker,
      abilities: {
        attacker: this.data.abilities.defender,
        defender: this.data.abilities.attacker,
      },
    }
    this._attacker = new CombatSideState(this, 'attacker')
    this._defender = new CombatSideState(this, 'defender')
    this._params = AbilitiesParams.fromConfig(this)
  }

  /** Set combat mode (for UI) */
  setCombatMode(mode: CombatMode): void {
    this.data = {
      ...this.data,
      combatMode: mode,
      currentPhase: getInitialPhaseIdentifier(mode),
    }
  }

  /** Build a read context for ability UI panels */
  getReadContext(side: CombatSide): AbilityReadContext {
    return buildReadContext(
      side,
      this.data,
      undefined,
      this._params.getAbilities(side),
    )
  }

  /** Collect dice for a side and source */
  collectDice(
    side: CombatSide,
    source: HitSource,
    allowedUnitTypes?: ReadonlySet<UnitType>,
  ): DicePool {
    const participatingUnits = this.getParticipatingUnits(side)
    return this.side(side).collectDice(
      source,
      participatingUnits,
      allowedUnitTypes,
    )
  }

  /** Get participating units from SETTINGS ability */
  getParticipatingUnits(side: CombatSide): ReadonlySet<UnitType> {
    const settings = this.data.abilities[side]['SETTINGS']

    if (!settings) {
      throw new Error('No SETTINGS in getParticipatingUnits')
    }

    const units =
      this.data.combatMode === 'GROUND'
        ? (settings.groundCombatParticipating as UnitType[])
        : (settings.spaceCombatParticipating as UnitType[])

    // Cache Set on the source array to avoid re-creating identical Sets
    let cached = participatingUnitsCache.get(units)
    if (!cached) {
      cached = new Set(units)
      participatingUnitsCache.set(units, cached)
    }
    return cached
  }

  /** Get valid targets for the current phase from SETTINGS ability for a specific side */
  private getValidTargetsForPhase(
    side: CombatSide,
    stateData: CombatStateData = this.data,
  ): UnitType[] {
    const settings = stateData.abilities[side]['SETTINGS']

    if (!settings) {
      throw new Error('No SETTINGS in getValidTargetsForPhase')
    }

    return getSettingsValidTargets(settings, this.currentPhase.meta)
  }

  private runAbilities<T extends AbilityTiming>(
    timing: T | T[],
    context?: TimingContextMap[T],
    stateData: CombatStateData = this.data,
    logger?: Logger,
  ): RunAbilitiesResult<T> {
    if (this.disableAbilities) {
      return {
        state: stateData,
        context,
        log: logger?.entries.concat([]) ?? [],
      } as RunAbilitiesResult<T>
    }
    const activeLogger = logger ?? Logger.create().child(this.currentPhase.meta)
    return this._params.runAbilities(
      timing,
      stateData,
      context,
      undefined,
      activeLogger,
    )
  }

  assignHits(parentLogger?: Logger): { state: CombatState; log: LogEntry[] } {
    const logger =
      parentLogger ??
      (this._enableLog
        ? Logger.create().child(this.currentPhase.meta)
        : undefined)
    const startIndex = logger ? logger.entries.length : 0

    const { state: afterAbilities } = this.runAbilities(
      'BEFORE_ASSIGN_HITS',
      undefined,
      this.data,
      logger,
    )

    const attackerParticipating = getParticipatingUnitsFromData(
      afterAbilities,
      'attacker',
    )
    const defenderParticipating = getParticipatingUnitsFromData(
      afterAbilities,
      'defender',
    )
    const attackerPriority = getUnitPriorityFromData(afterAbilities, 'attacker')
    const defenderPriority = getUnitPriorityFromData(afterAbilities, 'defender')

    const newAttacker = assignHitsToSide(
      afterAbilities.attacker,
      attackerParticipating,
      attackerPriority,
    )
    const newDefender = assignHitsToSide(
      afterAbilities.defender,
      defenderParticipating,
      defenderPriority,
    )

    const resultData: CombatStateData = {
      ...afterAbilities,
      attacker: newAttacker,
      defender: newDefender,
    }

    const destroyedContext = {
      attacker: getDestroyedUnits(afterAbilities.attacker, resultData.attacker),
      defender: getDestroyedUnits(afterAbilities.defender, resultData.defender),
    }

    if (logger) {
      logger.child('ASSIGN_HITS').log(destroyedContext)
    }

    if (
      destroyedContext.attacker.length === 0 &&
      destroyedContext.defender.length === 0
    ) {
      return {
        state: CombatState.fromData(resultData, this._params),
        log: logger ? [...logger.entries.slice(startIndex)] : [],
      }
    }

    // Run DESTROY first (cleanup, no cascading)
    const { state: afterCleanup } = this.runAbilities(
      'DESTROY',
      destroyedContext,
      resultData,
      logger,
    )

    // Run WHEN_DESTROY (may destroy additional units, e.g. Van Hauge)
    const { state: afterWhenDestroy } = this.runAbilities(
      'WHEN_DESTROY',
      destroyedContext,
      afterCleanup,
      logger,
    )

    // Skip diff when WHEN_DESTROY didn't change state (no ability fired)
    let mergedDestroyedContext = destroyedContext
    if (afterWhenDestroy !== afterCleanup) {
      const additionalAttacker = getDestroyedUnits(
        afterCleanup.attacker,
        afterWhenDestroy.attacker,
      )
      const additionalDefender = getDestroyedUnits(
        afterCleanup.defender,
        afterWhenDestroy.defender,
      )
      if (additionalAttacker.length > 0 || additionalDefender.length > 0) {
        mergedDestroyedContext = {
          attacker: [...destroyedContext.attacker, ...additionalAttacker],
          defender: [...destroyedContext.defender, ...additionalDefender],
        }
      }
    }

    // Then run AFTER_DESTROY with all destroyed units
    const { state: afterDestroy } = this.runAbilities(
      'AFTER_DESTROY',
      mergedDestroyedContext,
      afterWhenDestroy,
      logger,
    )

    return {
      state: CombatState.fromData(afterDestroy, this._params),
      log: logger ? [...logger.entries.slice(startIndex)] : [],
    }
  }

  isFinished(): boolean {
    return CombatState.isDataFinished(this.data)
  }

  /** Check if combat is finished directly from data (no CombatState allocation needed) */
  static isDataFinished(data: CombatStateData): boolean {
    const { meta, micro } = data.currentPhase

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

    // Count total units (all types)
    const attackerTotalUnits = countUnitsFromData(data.attacker.units)
    const defenderTotalUnits = countUnitsFromData(data.defender.units)

    // If either side has NO units at all, combat is finished —
    // unless we're in a unit ability phase where abilities can still inject dice
    if (attackerTotalUnits === 0 || defenderTotalUnits === 0) {
      if (
        meta !== 'SPACE_CANNON_OFFENSE' &&
        meta !== 'SPACE_CANNON_DEFENSE' &&
        meta !== 'BOMBARDMENT' &&
        meta !== 'AFB' &&
        meta !== 'COMMIT_UNITS'
      ) {
        return true
      }
    }

    // During combat phases, check if either side has no participating units
    if (meta === 'SPACE_COMBAT' || meta === 'GROUND_COMBAT') {
      const attackerParticipating = getParticipatingUnitsFromData(
        data,
        'attacker',
      )
      const defenderParticipating = getParticipatingUnitsFromData(
        data,
        'defender',
      )
      const attackerHasParticipating =
        countUnitsFromData(data.attacker.units, attackerParticipating) > 0
      const defenderHasParticipating =
        countUnitsFromData(data.defender.units, defenderParticipating) > 0

      if (!attackerHasParticipating || !defenderHasParticipating) {
        return true
      }
    }

    return false
  }

  getHash(): string {
    return `${getSideHash(this.data.attacker)}|${getSideHash(this.data.defender)}|${getAbilitiesHash(this.abilities)}`
  }

  /**
   * Advance using the two-tier phase system.
   * Handles meta-phase routing to appropriate processing methods.
   */
  public advance(round: number, enableLog = false): StateWithProbability[] {
    this._enableLog = enableLog
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

      case 'COMMIT_UNITS': {
        const { state: newData, log } = this.runAbilities('COMMIT_UNITS')
        return this.transitionPhaseWithData(
          newData,
          this._enableLog && log.length > 0 ? log : undefined,
        )
      }

      case 'SPACE_CANNON_DEFENSE':
        return this.advanceUnitAbilityPhase({
          firing: ['defender'],
          hitSource: 'SPACE_CANNON',
          allowedUnitTypes: new Set([...GROUND_FORCES, ...STRUCTURES]),
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
    validTargets: { attacker: UnitType[]; defender: UnitType[] },
    prependLog?: LogEntry[],
    afterRollTiming?: AbilityTiming,
  ): StateWithProbability[] {
    const attackerDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.attacker),
    )
    const defenderDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.defender),
    )
    const { meta: metaPhase } = this.currentPhase

    // Pre-compute next phase (DICE_ROLL is never last micro-phase)
    const { phase: nextPhase } = getNextMicroPhase(this.currentPhase)

    const results: StateWithProbability[] = []

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        // Build final data with hits + next phase in one spread
        let finalData = addHitsToDataWithPhase(
          stateData,
          attOutcome.hits,
          defOutcome.hits,
          validTargets,
          nextPhase,
        )

        let log: LogEntry[] | undefined
        if (this._enableLog) {
          const diceRollEntry: LogEntry = {
            path: [metaPhase, 'DICE_ROLL'],
            data: [{ attacker: attOutcome.hits, defender: defOutcome.hits }],
          }

          if (afterRollTiming) {
            log = prependLog ? [...prependLog, diceRollEntry] : [diceRollEntry]
            const afterRollLogger = Logger.create().child(metaPhase)
            const { state: afterRoll, log: afterRollLog } = this.runAbilities(
              afterRollTiming,
              undefined,
              finalData,
              afterRollLogger,
            )
            finalData = { ...afterRoll, currentPhase: nextPhase }
            if (afterRollLog.length > 0) log.push(...afterRollLog)
          } else {
            log = prependLog ? [...prependLog, diceRollEntry] : [diceRollEntry]
          }
        } else if (afterRollTiming) {
          const { state: afterRoll } = this.runAbilities(
            afterRollTiming,
            undefined,
            finalData,
          )
          finalData = { ...afterRoll, currentPhase: nextPhase }
        }

        results.push({
          state: CombatState.fromData(finalData, this._params),
          probability,
          log,
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

      // Check if we should skip to COMPLETE — directly on data, no temp CombatState
      let finalPhase = phase
      if (CombatState.isDataFinished({ ...data, currentPhase: phase })) {
        finalPhase = {
          meta: 'COMPLETE',
          micro: getLastMicroPhase('COMPLETE'),
        }
      }

      const nextState = CombatState.fromData(
        {
          ...data,
          currentPhase: finalPhase,
        },
        this._params,
      )
      return [{ state: nextState, probability: 1, log }]
    }

    // Otherwise, transition to next micro-phase
    const { phase } = getNextMicroPhase(this.currentPhase)
    const nextState = CombatState.fromData(
      { ...data, currentPhase: phase },
      this._params,
    )
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
    const { firing, hitSource, allowedUnitTypes } = config

    // Collect dice based on firing configuration
    const attackerDice = firing.includes('attacker')
      ? this.collectDice('attacker', hitSource, allowedUnitTypes)
      : {}
    const defenderDice = firing.includes('defender')
      ? this.collectDice('defender', hitSource, allowedUnitTypes)
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
    } = this.runAbilities('BEFORE_UNIT_ABILITY_ROLL', sidedDiceData)

    // Clear dice for sides not in firing config
    // (abilities may inject dice for non-firing sides, e.g. attacker during SCD)
    if (!firing.includes('attacker')) modifiedDice.attacker = {}
    if (!firing.includes('defender')) modifiedDice.defender = {}

    let prependLog: LogEntry[] | undefined
    if (this._enableLog) {
      const dicePoolLog: LogEntry = {
        path: [this.currentPhase.meta, 'DICE_POOL'],
        data: [
          {
            attacker: modifiedDice.attacker,
            defender: modifiedDice.defender,
          },
        ],
      }
      prependLog = [...abilityLog, dicePoolLog]
    }

    return this.rollDiceOutcomes(
      afterWhen,
      modifiedDice,
      {
        attacker: this.getValidTargetsForPhase('attacker', afterWhen),
        defender: this.getValidTargetsForPhase('defender', afterWhen),
      },
      prependLog,
      'AFTER_UNIT_ABILITY_ROLL',
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

    const resultLog = this._enableLog && log.length > 0 ? log : undefined

    // In round 1 of SPACE_COMBAT, transition to AFB meta-phase
    if (round === 1 && this.currentPhase.meta === 'SPACE_COMBAT') {
      const nextState = CombatState.fromData(
        {
          ...newData,
          currentPhase: { meta: 'AFB', micro: getFirstMicroPhase('AFB') },
        },
        this._params,
      )
      return [
        {
          state: nextState,
          probability: 1,
          log: resultLog,
        },
      ]
    }

    return this.transitionPhaseWithData(newData, resultLog)
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

    let prependLog: LogEntry[] | undefined
    if (this._enableLog) {
      const dicePoolLog: LogEntry = {
        path: [this.currentPhase.meta, 'DICE_POOL'],
        data: [
          {
            attacker: modifiedDice.attacker,
            defender: modifiedDice.defender,
          },
        ],
      }
      prependLog = [...abilityLog, dicePoolLog]
    }

    return this.rollDiceOutcomes(
      afterWhen,
      modifiedDice,
      {
        attacker: this.getValidTargetsForPhase('attacker', afterWhen),
        defender: this.getValidTargetsForPhase('defender', afterWhen),
      },
      prependLog,
      'AFTER_DICE_ROLL',
    )
  }

  private processAssignHits(): StateWithProbability[] {
    const { state: afterAssign, log } = this.assignHits()

    const { state: afterStep, log: stepLog } = this.runAbilities(
      'AFTER_ASSIGN_HITS_STEP',
      undefined,
      afterAssign.data,
    )

    if (!this._enableLog) {
      return this.transitionPhaseWithData(afterStep)
    }

    const allLog = [...log, ...stepLog]
    return this.transitionPhaseWithData(
      afterStep,
      allLog.length > 0 ? allLog : undefined,
    )
  }

  private processEndOfRound(): StateWithProbability[] {
    const timings = this.isLastRound()
      ? (['END_OF_COMBAT_ROUND', 'END_OF_COMBAT'] as const)
      : (['END_OF_COMBAT_ROUND'] as const)
    const { state: newData, log } = this.runAbilities([...timings])

    const { state: cleanedData } = this.runAbilities(
      'CLEANUP_ROUND',
      undefined,
      newData,
    )

    return this.transitionPhaseWithData(
      cleanedData,
      this._enableLog && log.length > 0 ? log : undefined,
    )
  }

  /** Check if this is the last round (one side has 0 participating units) */
  private isLastRound(): boolean {
    const attackerParticipating = this.getParticipatingUnits('attacker')
    const defenderParticipating = this.getParticipatingUnits('defender')
    const attackerHasParticipating =
      this.attacker.countUnits(attackerParticipating) > 0
    const defenderHasParticipating =
      this.defender.countUnits(defenderParticipating) > 0

    return !attackerHasParticipating || !defenderHasParticipating
  }
}

/** Add hits and set next phase in a single operation (avoids double spread) */
function addHitsToDataWithPhase(
  data: CombatStateData,
  attackerHits: number,
  defenderHits: number,
  validTargets: { attacker: UnitType[]; defender: UnitType[] },
  nextPhase: PhaseIdentifier,
): CombatStateData {
  const newData: CombatStateData = {
    ...data,
    currentPhase: nextPhase,
  }
  // Attacker's dice hit defender, defender's dice hit attacker
  if (attackerHits > 0) {
    newData.defender = {
      ...data.defender,
      hitPools: [
        ...data.defender.hitPools,
        { hits: attackerHits, validTargets: validTargets.defender },
      ],
    }
  }
  if (defenderHits > 0) {
    newData.attacker = {
      ...newData.attacker,
      hitPools: [
        ...data.attacker.hitPools,
        { hits: defenderHits, validTargets: validTargets.attacker },
      ],
    }
  }
  return newData
}

/** Count units directly from data without creating CombatSideState */
function countUnitsFromData(
  units: Record<string, number>,
  participatingUnits?: ReadonlySet<UnitType>,
): number {
  let total = 0
  for (const key in units) {
    const count = units[key]
    if (count <= 0) continue
    if (participatingUnits) {
      const { type } = parseVariantId(key)
      if (!participatingUnits.has(type)) continue
    }
    total += count
  }
  return total
}

/** Get participating units directly from data */
function getParticipatingUnitsFromData(
  data: CombatStateData,
  side: CombatSide,
): ReadonlySet<UnitType> {
  const settings = data.abilities[side]['SETTINGS']
  if (!settings) throw new Error('No SETTINGS in getParticipatingUnitsFromData')

  const units =
    data.combatMode === 'GROUND'
      ? (settings.groundCombatParticipating as UnitType[])
      : (settings.spaceCombatParticipating as UnitType[])

  let cached = participatingUnitsCache.get(units)
  if (!cached) {
    cached = new Set(units)
    participatingUnitsCache.set(units, cached)
  }
  return cached
}

/** Get unit priority directly from data */
function getUnitPriorityFromData(
  data: CombatStateData,
  side: CombatSide,
): string[] {
  const unitPriority = data.abilities[side]['UNIT_PRIORITY']
  if (!unitPriority)
    throw new Error('No UNIT_PRIORITY in getUnitPriorityFromData')

  const key =
    data.combatMode === 'GROUND' ? 'groundUnitPriority' : 'spaceUnitPriority'
  return unitPriority[key] as string[]
}

/** Assign hits to a side directly on data, returning new SideStateData */
function assignHitsToSide(
  sideData: SideStateData,
  participatingUnits: ReadonlySet<UnitType>,
  unitPriority: string[],
): SideStateData {
  if (sideData.hitPools.length === 0) return sideData

  const sacrificeOrder = unitPriority.filter(id => {
    const { type } = parseVariantId(id)
    return participatingUnits.has(type)
  })

  let current = sideData
  for (const pool of sideData.hitPools) {
    current = destroyUnitsFromPool(
      current,
      pool.hits,
      pool.validTargets,
      sacrificeOrder,
    )
  }

  return { ...current, hitPools: [] }
}

const abilitiesSideHashCache = new WeakMap<
  Record<string, Record<string, unknown>>,
  string
>()

function getAbilitiesHash(abilities: AbilitiesConfig): string {
  const hashSide = (side: AbilitiesConfig[keyof AbilitiesConfig]) => {
    const cached = abilitiesSideHashCache.get(side)
    if (cached !== undefined) return cached
    const keys = Object.keys(side).sort()
    const result =
      keys.length === 0
        ? ''
        : keys.map(k => `${k}:${JSON.stringify(side[k])}`).join(',')
    abilitiesSideHashCache.set(side, result)
    return result
  }
  const a = hashSide(abilities.attacker)
  const d = hashSide(abilities.defender)
  if (!a && !d) return ''
  return `a{${a}}d{${d}}`
}

const sideHashCache = new WeakMap<SideStateData, string>()

function getSideHash(side: SideStateData): string {
  const cached = sideHashCache.get(side)
  if (cached !== undefined) return cached

  const parts: string[] = []
  const sortedKeys = Object.keys(side.units).sort()

  for (const key of sortedKeys) {
    const count = side.units[key]
    if (count <= 0) continue

    // Group by mutable state (isDamaged only — subtypes are in the key)
    const stateArr = side.unitState[key]
    if (stateArr && stateArr.length > 0) {
      const groups = new Map<string, number>()
      // Count units with each unique state signature
      for (let i = 0; i < count; i++) {
        const us = stateArr[i]
        const stateKey = us?.isDamaged ? 'd' : ''
        groups.set(stateKey, (groups.get(stateKey) ?? 0) + 1)
      }

      const groupParts = [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([stateKey, c]) => (stateKey ? `${c}${stateKey}` : String(c)))
        .join(',')
      parts.push(`${key}:${groupParts}`)
    } else {
      parts.push(`${key}:${count}`)
    }
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

  const result = parts.join(',')
  sideHashCache.set(side, result)
  return result
}
