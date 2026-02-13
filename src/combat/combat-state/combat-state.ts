import factions from '@/data/faction'
import type { CombatSide, DiceGroup, FactionKey, Unit, UnitType } from '@/types'
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
} from '../combat-side-state/combat-side-state'
import { getDestroyedUnits } from '../combat-side-state/utils/get-destroyed-units'
import { getSettingsValidTargets } from '../combat-side-state/utils/get-settings-valid-targets'
import { Logger } from '../logger'
import type { LogEntry } from '../types'
import { getCombinedDiceDistribution } from '../utils'
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

/** Main combat state class */
export class CombatState {
  data: CombatStateData
  private _params!: AbilitiesParams
  private _attacker!: CombatSideState
  private _defender!: CombatSideState

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
        hitPools: [],
        unitSelections: createDefaultUnitSelections(),
        unitStats: defaultUnitStats,
      },
      defender: {
        faction: defaultFaction,
        units: {},
        hitPools: [],
        unitSelections: createDefaultUnitSelections(),
        unitStats: defaultUnitStats,
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
    return buildReadContext(side, this.data)
  }

  /** Collect dice for a side and source */
  collectDice(side: CombatSide, source: HitSource): DicePool {
    const participatingUnits = this.getParticipatingUnits(side)
    return this.side(side).collectDice(source, participatingUnits)
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

    return new Set(units)
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

  /** Get unit priority from UNIT_PRIORITY ability if present */
  private getUnitPriority(side: CombatSide): string[] {
    const unitPriority = this.data.abilities[side]['UNIT_PRIORITY']

    if (!unitPriority) {
      throw new Error('No UNIT_PRIORITY in getUnitPriority')
    }

    const key =
      this.combatMode === 'GROUND' ? 'groundUnitPriority' : 'spaceUnitPriority'
    return unitPriority[key] as string[]
  }

  private runAbilities<T extends AbilityTiming>(
    timing: T | T[],
    context?: TimingContextMap[T],
    stateData: CombatStateData = this.data,
    logger?: Logger,
  ): RunAbilitiesResult<T> {
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
    const logger = parentLogger ?? Logger.create().child(this.currentPhase.meta)
    const startIndex = logger.entries.length

    const { state: afterAbilities } = this.runAbilities(
      'BEFORE_ASSIGN_HITS',
      undefined,
      this.data,
      logger,
    )

    const tempState = CombatState.fromData(afterAbilities, this._params)
    const attackerParticipating = tempState.getParticipatingUnits('attacker')
    const defenderParticipating = tempState.getParticipatingUnits('defender')
    const attackerPriority = tempState.getUnitPriority('attacker')
    const defenderPriority = tempState.getUnitPriority('defender')

    tempState.attacker.assignHits(attackerParticipating, attackerPriority)
    tempState.defender.assignHits(defenderParticipating, defenderPriority)
    const resultData = tempState.data

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

    logger.child('ASSIGN_HITS').log(destroyedContext)

    if (
      destroyedContext.attacker.length === 0 &&
      destroyedContext.defender.length === 0
    ) {
      return {
        state: CombatState.fromData(resultData, this._params),
        log: [...logger.entries.slice(startIndex)],
      }
    }

    // Run WHEN_DESTROY first (may destroy additional units, e.g. Van Hauge)
    const { state: afterWhenDestroy } = this.runAbilities(
      'WHEN_DESTROY',
      destroyedContext,
      resultData,
      logger,
    )

    // Compute additional destroyed units from WHEN_DESTROY effects
    const additionalAttacker = getDestroyedUnits(
      resultData.attacker.units,
      afterWhenDestroy.attacker.units,
    )
    const additionalDefender = getDestroyedUnits(
      resultData.defender.units,
      afterWhenDestroy.defender.units,
    )

    // Merge all destroyed units for AFTER_DESTROY
    const mergedDestroyedContext = {
      attacker: [...destroyedContext.attacker, ...additionalAttacker],
      defender: [...destroyedContext.defender, ...additionalDefender],
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
      log: [...logger.entries.slice(startIndex)],
    }
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
    const attackerTotalUnits = this.attacker.countUnits()
    const defenderTotalUnits = this.defender.countUnits()

    // If either side has NO units at all, combat is finished —
    // unless we're in a unit ability phase where abilities can still inject dice
    if (attackerTotalUnits === 0 || defenderTotalUnits === 0) {
      if (
        meta !== 'SPACE_CANNON_OFFENSE' &&
        meta !== 'SPACE_CANNON_DEFENSE' &&
        meta !== 'BOMBARDMENT' &&
        meta !== 'AFB'
      ) {
        return true
      }
    }

    // During combat phases, check if either side has no participating units
    if (meta === 'SPACE_COMBAT' || meta === 'GROUND_COMBAT') {
      const attackerParticipating = this.getParticipatingUnits('attacker')
      const defenderParticipating = this.getParticipatingUnits('defender')
      const attackerHasParticipating =
        this.attacker.countUnits(attackerParticipating) > 0
      const defenderHasParticipating =
        this.defender.countUnits(defenderParticipating) > 0

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
    validTargets: { attacker: UnitType[]; defender: UnitType[] },
    prependLog?: LogEntry[],
    runAfterRoll = false,
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
        const tempCS = CombatState.fromData(stateData, this._params)
        tempCS.defender.addHits(attOutcome.hits, validTargets.defender)
        tempCS.attacker.addHits(defOutcome.hits, validTargets.attacker)
        let resultData = tempCS.data

        const log: LogEntry[] = [...(prependLog ?? [])]
        log.push({
          path: [metaPhase, 'DICE_ROLL'],
          data: [{ attacker: attOutcome.hits, defender: defOutcome.hits }],
        })

        if (runAfterRoll) {
          const afterRollLogger = Logger.create().child(metaPhase)
          const { state: afterRoll, log: afterRollLog } = this.runAbilities(
            'AFTER_UNIT_ABILITY_ROLL',
            undefined,
            resultData,
            afterRollLogger,
          )
          resultData = afterRoll
          log.push(...afterRollLog)
        }

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
      const tempState = CombatState.fromData(
        { ...data, currentPhase: phase },
        this._params,
      )

      if (tempState.isFinished()) {
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
    } = this.runAbilities('BEFORE_UNIT_ABILITY_ROLL', sidedDiceData)

    const dicePoolLog: LogEntry = {
      path: [this.currentPhase.meta, 'DICE_POOL'],
      data: [
        { attacker: modifiedDice.attacker, defender: modifiedDice.defender },
      ],
    }
    const prependLog = [...abilityLog, dicePoolLog]

    return this.rollDiceOutcomes(
      afterWhen,
      modifiedDice,
      {
        attacker: this.getValidTargetsForPhase('attacker', afterWhen),
        defender: this.getValidTargetsForPhase('defender', afterWhen),
      },
      prependLog,
      true,
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

    const dicePoolLog: LogEntry = {
      path: [this.currentPhase.meta, 'DICE_POOL'],
      data: [
        { attacker: modifiedDice.attacker, defender: modifiedDice.defender },
      ],
    }
    const prependLog = [...abilityLog, dicePoolLog]

    return this.rollDiceOutcomes(
      afterWhen,
      modifiedDice,
      {
        attacker: this.getValidTargetsForPhase('attacker', afterWhen),
        defender: this.getValidTargetsForPhase('defender', afterWhen),
      },
      prependLog,
    )
  }

  private processAssignHits(): StateWithProbability[] {
    const { state: afterAssign, log } = this.assignHits()

    const { state: afterStep, log: stepLog } = this.runAbilities(
      'AFTER_ASSIGN_HITS_STEP',
      undefined,
      afterAssign.data,
    )

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
      log.length > 0 ? log : undefined,
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

function getAbilitiesHash(abilities: AbilitiesConfig): string {
  const hashSide = (side: AbilitiesConfig[keyof AbilitiesConfig]) => {
    const keys = Object.keys(side).sort()
    if (keys.length === 0) return ''
    return keys.map(k => `${k}:${JSON.stringify(side[k])}`).join(',')
  }
  const a = hashSide(abilities.attacker)
  const d = hashSide(abilities.defender)
  if (!a && !d) return ''
  return `a{${a}}d{${d}}`
}

function getUnitStateKey(u: Unit): string {
  let key = ''
  if (u.isDamaged) key += 'd'
  if (u.subtypes?.length) key += ':' + u.subtypes.toSorted().join('+')
  return key
}

function getSideHash(side: SideStateData): string {
  const parts: string[] = []
  const sortedTypes = Object.keys(side.units).sort()

  for (const type of sortedTypes) {
    const units = side.units[type as keyof typeof side.units]
    if (!units || units.length === 0) continue

    // Group by mutable state (isDamaged, subtypes)
    const groups = new Map<string, number>()
    for (const u of units) {
      const stateKey = getUnitStateKey(u)
      groups.set(stateKey, (groups.get(stateKey) ?? 0) + 1)
    }

    // Encode as TYPE:count or TYPE:count,countSTATE,...
    const groupParts = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stateKey, count]) =>
        stateKey ? `${count}${stateKey}` : String(count),
      )
      .join(',')
    parts.push(`${type}:${groupParts}`)
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
