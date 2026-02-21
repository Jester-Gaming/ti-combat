import { create } from 'mutative'

import { GROUND_FORCES, STRUCTURES } from '@/constants/units'
import factions from '@/data/faction'
import type { CombatSide, DiceGroup, FactionKey, UnitBaseType } from '@/types'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

import {
  AbilitiesParams,
  type AbilityReadContext,
  cloneInvokes,
  type InvokeCollections,
  type RunAbilitiesResult,
  type SidedDiceData,
} from '../abilities'
import type {
  AbilityTiming,
  DicePool,
  TimingContextMap,
} from '../abilities/types'
import {
  CombatSideState,
  createDefaultUnitSelections,
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
  HitValueModifier,
  MetaPhase,
  PhaseIdentifier,
  SideStateData,
} from './types'

/** Shared empty array to avoid allocating new [] on every disabled-abilities call */
const EMPTY_LOG: LogEntry[] = []

/** A state with its probability and log entries */
export interface StateWithProbability {
  state: CombatState
  probability: number
  log?: LogEntry[]
}

interface UnitAbilityPhaseConfig {
  firing: CombatSide[]
  hitSource: HitSource
  allowedUnitTypes?: ReadonlySet<UnitBaseType>
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
const participatingUnitsCache = new WeakMap<
  UnitBaseType[],
  ReadonlySet<UnitBaseType>
>()

/** Main combat state class */
export class CombatState {
  data: CombatStateData
  private _enableLog = false
  private _params!: AbilitiesParams
  private _attacker: CombatSideState | undefined
  private _defender: CombatSideState | undefined
  public _invokes!: InvokeCollections
  public _invokesOwned = true

  ensureOwnInvokes(): void {
    if (!this._invokesOwned) {
      this._invokes = cloneInvokes(this._invokes)
      this._invokesOwned = true
    }
  }

  get disableAbilities() {
    return false
  }

  get attacker(): CombatSideState {
    return (this._attacker ??= new CombatSideState(this, 'attacker'))
  }

  get defender(): CombatSideState {
    return (this._defender ??= new CombatSideState(this, 'defender'))
  }

  side(side: CombatSide): CombatSideState {
    return side === 'attacker' ? this.attacker : this.defender
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
    // CombatSideState instances created lazily via getters
    if (params) {
      instance._params = params
      const source = params.combatState
      instance._invokes = source._invokes
      instance._invokesOwned = false
      source._invokesOwned = false
    } else {
      instance._params = AbilitiesParams.wrap(instance)
    }
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
    return this._params.context(side) as unknown as AbilityReadContext
  }

  /** Collect dice for a side and source */
  collectDice(
    side: CombatSide,
    source: HitSource,
    allowedUnitTypes?: ReadonlySet<UnitBaseType>,
  ): DicePool {
    const participatingUnits = this.getParticipatingUnits(side)
    return this.side(side).collectDice(
      source,
      participatingUnits,
      allowedUnitTypes,
    )
  }

  /** Get participating units from SETTINGS ability */
  getParticipatingUnits(side: CombatSide): ReadonlySet<UnitBaseType> {
    const settings = this.data.abilities[side]['SETTINGS']

    if (!settings) {
      throw new Error('No SETTINGS in getParticipatingUnits')
    }

    const units =
      this.data.combatMode === 'GROUND'
        ? (settings.groundCombatParticipating as UnitBaseType[])
        : (settings.spaceCombatParticipating as UnitBaseType[])

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
  ): UnitBaseType[] {
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
        log: EMPTY_LOG,
      } as RunAbilitiesResult<T>
    }
    this._params.setCombatState(this)
    // Only create Logger when logging is enabled — avoids allocations
    // on every call when abilities short-circuit during simulation
    const activeLogger =
      logger ??
      (this._enableLog
        ? Logger.create().child(this.currentPhase.meta)
        : undefined)
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

    // Skip getDestroyedUnits when units refs haven't changed (no units destroyed)
    const attackerChanged =
      afterAbilities.attacker.units !== resultData.attacker.units
    const defenderChanged =
      afterAbilities.defender.units !== resultData.defender.units

    const EMPTY_DESTROYED: Record<string, number> = {}
    const destroyedContext = {
      attacker: attackerChanged
        ? getDestroyedUnits(afterAbilities.attacker, resultData.attacker)
        : EMPTY_DESTROYED,
      defender: defenderChanged
        ? getDestroyedUnits(afterAbilities.defender, resultData.defender)
        : EMPTY_DESTROYED,
    }

    if (logger) {
      logger.child('ASSIGN_HITS').log(destroyedContext)
    }

    if (
      destroyedContext.attacker === EMPTY_DESTROYED &&
      destroyedContext.defender === EMPTY_DESTROYED
    ) {
      return {
        state: CombatState.fromData(resultData, this._params),
        log: logger ? [...logger.entries.slice(startIndex)] : [],
      }
    }

    // Run DESTROY → WHEN_DESTROY → AFTER_DESTROY sequence
    const afterDestroy = this._params.runDestroyAbilities(
      destroyedContext,
      resultData,
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
  static isDataFinished(
    data: CombatStateData,
    phaseOverride?: PhaseIdentifier,
  ): boolean {
    const { meta, micro } = phaseOverride ?? data.currentPhase

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

    // Check if either side has NO units at all — combat is finished
    // unless we're in a unit ability phase where abilities can still inject dice
    if (
      !hasAnyUnits(data.attacker.units) ||
      !hasAnyUnits(data.defender.units)
    ) {
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

      if (
        !hasParticipatingUnits(data.attacker.units, attackerParticipating) ||
        !hasParticipatingUnits(data.defender.units, defenderParticipating)
      ) {
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
    validTargets: { attacker: UnitBaseType[]; defender: UnitBaseType[] },
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

    // Save baseline _invokes reference — COW protects it from mutation
    const baseInvokes = this._invokes

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        // Reset _invokes to baseline for this outcome (COW armed)
        this._invokes = baseInvokes
        this._invokesOwned = false

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
            if (afterRoll !== finalData) {
              finalData = { ...afterRoll, currentPhase: nextPhase }
            }
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
          // Skip spread when abilities didn't change state (short-circuited) —
          // finalData already has nextPhase from addHitsToDataWithPhase
          if (afterRoll !== finalData) {
            finalData = { ...afterRoll, currentPhase: nextPhase }
          }
        }

        results.push({
          state: CombatState.fromData(finalData, this._params),
          probability,
          log,
        })
      }
    }

    // Restore baseline
    this._invokes = baseInvokes
    this._invokesOwned = true

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

      // Check if we should skip to COMPLETE — uses phase override to avoid temp object
      // knownFinished allows callers to skip the redundant isDataFinished check
      let finalPhase = phase
      const shouldComplete = CombatState.isDataFinished(data, phase)
      if (shouldComplete) {
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

    // Apply stored hit-value modifiers
    const meta = this.currentPhase.meta
    if (afterWhen.attacker.hitValueModifiers?.length) {
      applyStoredHitValueModifiers(
        modifiedDice.attacker,
        afterWhen.attacker.hitValueModifiers,
        meta,
      )
    }
    if (afterWhen.defender.hitValueModifiers?.length) {
      applyStoredHitValueModifiers(
        modifiedDice.defender,
        afterWhen.defender.hitValueModifiers,
        meta,
      )
    }

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

    // Apply stored hit-value modifiers (from ctx.api.own.modifyHitValue)
    const meta = this.currentPhase.meta
    if (afterWhen.attacker.hitValueModifiers?.length) {
      applyStoredHitValueModifiers(
        modifiedDice.attacker,
        afterWhen.attacker.hitValueModifiers,
        meta,
      )
    }
    if (afterWhen.defender.hitValueModifiers?.length) {
      applyStoredHitValueModifiers(
        modifiedDice.defender,
        afterWhen.defender.hitValueModifiers,
        meta,
      )
    }

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
    const { state: newData, log } = this.runAbilities(['END_OF_COMBAT_ROUND'])

    let { state: cleanedData } = this.runAbilities(
      'CLEANUP_ROUND',
      undefined,
      newData,
    )

    // Clear stored hit-value modifiers
    if (
      cleanedData.attacker.hitValueModifiers?.length ||
      cleanedData.defender.hitValueModifiers?.length
    ) {
      cleanedData = create(cleanedData, draft => {
        delete draft.attacker.hitValueModifiers
        delete draft.defender.hitValueModifiers
      })
    }

    return this.transitionPhaseWithData(
      cleanedData,
      this._enableLog && log.length > 0 ? log : undefined,
    )
  }
}

/** Apply stored hit-value modifiers to a dice pool for one side */
function applyStoredHitValueModifiers(
  pool: DicePool,
  modifiers: readonly HitValueModifier[],
  currentMeta: MetaPhase,
): void {
  for (const mod of modifiers) {
    if (mod.context !== currentMeta) continue

    if (mod.unitLocator) {
      // Target specific unit by locator
      for (const dice of Object.values(pool)) {
        if (!dice) continue
        for (let i = 0; i < dice.length; i++) {
          const loc = dice[i][2]
          if (
            loc.key === mod.unitLocator.key &&
            loc.index === mod.unitLocator.index
          ) {
            dice[i] = [
              Math.max(1, dice[i][0] + mod.amount),
              dice[i][1],
              dice[i][2],
            ]
            break
          }
        }
      }
      continue
    }

    for (const [type, dice] of Object.entries(pool)) {
      if (!dice) continue
      if (mod.unitType && type !== mod.unitType) continue
      if (mod.excludeUnitTypes?.includes(type)) continue
      for (let i = 0; i < dice.length; i++) {
        dice[i] = [Math.max(1, dice[i][0] + mod.amount), dice[i][1], dice[i][2]]
      }
    }
  }
}

/** Add hits and set next phase — constructs result directly to minimize spreads */
function addHitsToDataWithPhase(
  data: CombatStateData,
  attackerHits: number,
  defenderHits: number,
  validTargets: { attacker: UnitBaseType[]; defender: UnitBaseType[] },
  nextPhase: PhaseIdentifier,
): CombatStateData {
  return {
    // Defender's dice hit attacker
    attacker:
      defenderHits > 0
        ? {
            ...data.attacker,
            hitPools:
              data.attacker.hitPools.length === 0
                ? [
                    {
                      hits: defenderHits,
                      validTargets: validTargets.attacker,
                    },
                  ]
                : [
                    ...data.attacker.hitPools,
                    {
                      hits: defenderHits,
                      validTargets: validTargets.attacker,
                    },
                  ],
          }
        : data.attacker,
    // Attacker's dice hit defender
    defender:
      attackerHits > 0
        ? {
            ...data.defender,
            hitPools:
              data.defender.hitPools.length === 0
                ? [
                    {
                      hits: attackerHits,
                      validTargets: validTargets.defender,
                    },
                  ]
                : [
                    ...data.defender.hitPools,
                    {
                      hits: attackerHits,
                      validTargets: validTargets.defender,
                    },
                  ],
          }
        : data.defender,
    abilities: data.abilities,
    combatMode: data.combatMode,
    currentPhase: nextPhase,
  }
}

/** Check if units record has any units at all (no type filtering) */
function hasAnyUnits(units: Record<string, number>): boolean {
  for (const _ in units) return true
  return false
}

/** Check if units record has any units of participating types (early exit) */
function hasParticipatingUnits(
  units: Record<string, number>,
  participatingUnits: ReadonlySet<UnitBaseType>,
): boolean {
  for (const key in units) {
    if (units[key] <= 0) continue
    const { type } = parseVariantId(key)
    if (participatingUnits.has(type)) return true
  }
  return false
}

/** Get participating units directly from data */
function getParticipatingUnitsFromData(
  data: CombatStateData,
  side: CombatSide,
): ReadonlySet<UnitBaseType> {
  const settings = data.abilities[side]['SETTINGS']
  if (!settings) throw new Error('No SETTINGS in getParticipatingUnitsFromData')

  const units =
    data.combatMode === 'GROUND'
      ? (settings.groundCombatParticipating as UnitBaseType[])
      : (settings.spaceCombatParticipating as UnitBaseType[])

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

// Cache for filtered sacrifice order: unitPriority array → (participatingSet → filtered order)
const sacrificeOrderCache = new WeakMap<
  string[],
  Map<ReadonlySet<UnitBaseType>, string[]>
>()

function getFilteredSacrificeOrder(
  unitPriority: string[],
  participatingUnits: ReadonlySet<UnitBaseType>,
): string[] {
  let map = sacrificeOrderCache.get(unitPriority)
  if (map) {
    const cached = map.get(participatingUnits)
    if (cached) return cached
  }

  const result = unitPriority.filter(id => {
    const { type } = parseVariantId(id)
    return participatingUnits.has(type)
  })

  if (!map) {
    map = new Map()
    sacrificeOrderCache.set(unitPriority, map)
  }
  map.set(participatingUnits, result)
  return result
}

/** Assign hits to a side directly on data, returning new SideStateData.
 * Batches all hit pools into a single pass to minimize object spreads. */
function assignHitsToSide(
  sideData: SideStateData,
  participatingUnits: ReadonlySet<UnitBaseType>,
  unitPriority: string[],
): SideStateData {
  if (sideData.hitPools.length === 0) return sideData

  const sacrificeOrder = getFilteredSacrificeOrder(
    unitPriority,
    participatingUnits,
  )

  // Spread once, then mutate in-place across all pools
  const newUnits = { ...sideData.units }
  const newUnitState = { ...sideData.unitState }
  let changed = false

  for (const pool of sideData.hitPools) {
    let remaining = pool.hits
    if (remaining <= 0) continue

    const validTargets = pool.validTargets

    for (const variantId of sacrificeOrder) {
      if (remaining <= 0) break
      if (
        validTargets.length > 0 &&
        !validTargets.includes(parseVariantId(variantId).type)
      )
        continue

      const count = newUnits[variantId]
      if (!count || count <= 0) continue

      const toDestroy = Math.min(count, remaining)
      const newCount = count - toDestroy
      changed = true

      if (newCount <= 0) {
        delete newUnits[variantId]
        delete newUnitState[variantId]
      } else {
        newUnits[variantId] = newCount
        const stateArr = newUnitState[variantId]
        if (stateArr && stateArr.length > newCount) {
          newUnitState[variantId] = stateArr.slice(0, newCount)
        }
      }

      remaining -= toDestroy
    }
  }

  // Always clear hitPools — even when no units were destroyed,
  // stale pools must not leak into subsequent phases
  if (!changed) return { ...sideData, hitPools: [] }

  return { ...sideData, units: newUnits, unitState: newUnitState, hitPools: [] }
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

  // Build hash via string concatenation — avoids intermediate arrays
  let result = ''
  const keys = Object.keys(side.units)
  if (keys.length > 1) keys.sort()

  for (const key of keys) {
    const count = side.units[key]
    if (count <= 0) continue

    if (result) result += ','

    // Count damaged units directly — avoids Map allocation
    const stateArr = side.unitState[key]
    if (stateArr && stateArr.length > 0) {
      let damaged = 0
      for (let i = 0; i < count; i++) {
        if (stateArr[i]?.isDamaged) damaged++
      }
      const undamaged = count - damaged
      if (damaged === 0) {
        result += key + ':' + count
      } else if (undamaged === 0) {
        result += key + ':' + damaged + 'd'
      } else {
        // '' sorts before 'd', so undamaged first
        result += key + ':' + undamaged + ',' + damaged + 'd'
      }
    } else {
      result += key + ':' + count
    }
  }

  sideHashCache.set(side, result)
  return result
}
