import { GROUND_FORCES, STRUCTURES } from '@/constants/units'
import type { CombatSide, DiceGroup, UnitBaseType, UnitType } from '@/types'

import {
  AbilitiesEngine,
  cloneInvokes,
  type InvokeCollections,
  type SidedDiceData,
} from '../abilities-engine'
import type {
  AbilityTiming,
  DicePool,
  TimingContextMap,
} from '../abilities-engine/types'
import {
  CombatSideState,
  getParticipatingUnitsSet,
} from '../combat-side-state/combat-side-state'
import { type LogEntry, Logger } from '../logger'
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

/** A state with its probability */
export interface StateWithProbability {
  state: CombatState
  probability: number
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

/** Main combat state class */
export class CombatState {
  data!: CombatStateData
  _logger?: Logger
  private _params!: AbilitiesEngine
  private _attacker: CombatSideState | undefined
  private _defender: CombatSideState | undefined
  public _invokes!: InvokeCollections
  public _invokesOwned = true

  get log(): LogEntry[] | undefined {
    return this._logger?.entries as LogEntry[] | undefined
  }

  get currentPhase(): PhaseIdentifier {
    return this.data.currentPhase
  }

  ensureOwnInvokes(): void {
    if (!this._invokesOwned) {
      this._invokes = cloneInvokes(this._invokes)
      this._invokesOwned = true
    }
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

  get params(): AbilitiesEngine {
    return this._params
  }

  /** Create CombatState for simulation */
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

    const baseData: CombatStateData = {
      attacker,
      defender,
      abilities: config,
      combatMode,
      currentPhase: currentPhase ?? getInitialPhaseIdentifier(combatMode),
    }

    instance.data = baseData
    instance._params = AbilitiesEngine.fromConfig(instance)

    // PREPARE abilities mutate baseData in-place
    instance._params.runAbilities('PREPARE')

    return instance
  }

  public static fromData(
    data: CombatStateData,
    params: AbilitiesEngine,
  ): CombatState {
    const instance = Object.create(CombatState.prototype) as CombatState
    instance.data = data
    instance._params = params
    const source = params.combatState
    instance._invokes = source._invokes
    instance._invokesOwned = false
    source._invokesOwned = false
    return instance
  }

  public static fromDataStandalone(data: CombatStateData): CombatState {
    const instance = Object.create(CombatState.prototype) as CombatState
    instance.data = data
    instance._params = AbilitiesEngine.wrap(instance)
    return instance
  }

  private runAbilities<T extends AbilityTiming>(
    timing: T | T[],
    context?: TimingContextMap[T],
  ): TimingContextMap[T] {
    this._params.setCombatState(this, this._logger)
    return this._params.runAbilities(
      timing,
      context,
      undefined,
      this._logger?.child(this.data.currentPhase.meta),
    )
  }

  assignHits(): void {
    const trackDestroyed = !!this._logger || this._params.hasDestroyAbilities()

    this.runAbilities('BEFORE_ASSIGN_HITS')

    const attackerDestroyed = this.side('attacker').assignHits(
      this.data,
      trackDestroyed,
    )
    const defenderDestroyed = this.side('defender').assignHits(
      this.data,
      trackDestroyed,
    )

    // Fast path: no destroy abilities and no logger — skip destroyed tracking entirely
    if (!trackDestroyed) return

    const destroyedContext = {
      attacker: attackerDestroyed,
      defender: defenderDestroyed,
    }

    this._logger
      ?.child(this.data.currentPhase.meta)
      .child('ASSIGN_HITS')
      .log(destroyedContext)

    const hasDestroyed =
      Object.keys(destroyedContext.attacker).length > 0 ||
      Object.keys(destroyedContext.defender).length > 0

    if (hasDestroyed) {
      // Run DESTROY → WHEN_DESTROY → AFTER_DESTROY sequence
      this._params.runDestroyAbilities(destroyedContext)
    }
  }

  isFinished(): boolean {
    return this.data.currentPhase.meta === 'COMPLETE'
  }

  getHash(): string {
    return `${getSideHash(this.data.attacker)}|${getSideHash(this.data.defender)}|${getAbilitiesHash(this.abilities)}`
  }

  /**
   * Advance using the two-tier phase system.
   * Handles meta-phase routing to appropriate processing methods.
   */
  public advance(round: number, enableLog = false): StateWithProbability[] {
    if (enableLog && !this._logger) {
      this._logger = Logger.create()
    }
    const { meta } = this.data.currentPhase

    if (meta === 'COMPLETE') {
      return [{ state: this, probability: 1 }]
    }

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
        this.runAbilities('COMMIT_UNITS')
        return this.transitionPhase()
      }

      case 'SPACE_CANNON_DEFENSE':
        return this.advanceUnitAbilityPhase({
          firing: ['defender'],
          hitSource: 'SPACE_CANNON',
          allowedUnitTypes: new Set([...GROUND_FORCES, ...STRUCTURES]),
        })
    }
  }

  private advanceCombatPhase(round: number): StateWithProbability[] {
    const micro = this.data.currentPhase.micro

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
    modifiedDice: SidedDiceData,
    validTargets: { attacker: UnitType[]; defender: UnitType[] },
    afterRollTiming?: AbilityTiming,
  ): StateWithProbability[] {
    const attackerDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.attacker),
    )
    const defenderDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.defender),
    )

    const nextPhase = getNextMicroPhase(this.data.currentPhase)
    const { meta: metaPhase } = this.data.currentPhase

    const results: StateWithProbability[] = []

    // Save baseline _invokes reference — COW protects it from mutation
    const baseInvokes = this._invokes

    // Check once whether after-roll abilities exist — avoids per-branch
    // deepCloneSides + runAbilities overhead when no abilities are registered.
    const runAfterRoll =
      afterRollTiming != null && this._params.hasCallableInvoke(afterRollTiming)

    // this.data is the base for all branches (plain object, already mutated by
    // preceding abilities). Each branch gets an independent shallow copy.
    const baseData = this.data

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        // Reset _invokes to baseline for this outcome (COW armed)
        this._invokes = baseInvokes
        this._invokesOwned = false

        // Light copy per branch — only hitPools + currentPhase are new.
        // units/unitState stay shared with base until abilities need them.
        const branchData = cloneStateForBranch(baseData, nextPhase)
        addHitsToData(
          branchData,
          attOutcome.hits,
          defOutcome.hits,
          validTargets,
        )

        const branchLogger = this._logger?.fork()
        branchLogger?.child(metaPhase).child('DICE_ROLL').log({
          attacker: attOutcome.hits,
          defender: defOutcome.hits,
        })

        if (runAfterRoll) {
          this.data = branchData
          this._params.setCombatState(this, branchLogger)
          this._params.runAbilities(
            afterRollTiming!,
            undefined,
            undefined,
            branchLogger?.child(metaPhase),
          )
        }

        const branchState = CombatState.fromData(branchData, this._params)
        branchState._logger = branchLogger
        results.push({ state: branchState, probability })
      }
    }

    // Restore baseline
    this._invokes = baseInvokes
    this._invokesOwned = true

    return results
  }

  private transitionPhase(): StateWithProbability[] {
    this.data.currentPhase = isLastMicroPhase(this.data.currentPhase)
      ? getNextMetaPhase(this.data.currentPhase, this.combatMode)
      : getNextMicroPhase(this.data.currentPhase)

    const state = CombatState.fromData(this.data, this._params)
    state._logger = this._logger
    return [{ state, probability: 1 }]
  }

  private completeTransition(): StateWithProbability[] {
    this.data.currentPhase = {
      meta: 'COMPLETE' as const,
      micro: getLastMicroPhase('COMPLETE'),
    }

    const state = CombatState.fromData(this.data, this._params)
    state._logger = this._logger
    return [{ state, probability: 1 }]
  }

  // ===========================================================================
  // UNIT ABILITY PHASE PROCESSING (Space Cannon, Bombardment)
  // ===========================================================================

  private advanceUnitAbilityPhase(
    config: UnitAbilityPhaseConfig,
  ): StateWithProbability[] {
    const micro = this.data.currentPhase.micro

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
      ? this.side('attacker').collectDice(hitSource, allowedUnitTypes)
      : {}
    const defenderDice = firing.includes('defender')
      ? this.side('defender').collectDice(hitSource, allowedUnitTypes)
      : {}

    const sidedDiceData: SidedDiceData = {
      attacker: attackerDice,
      defender: defenderDice,
    }

    // All unit ability timings use SidedDiceData context
    const modifiedDice = this.runAbilities(
      'BEFORE_UNIT_ABILITY_ROLL',
      sidedDiceData,
    )

    // Apply stored hit-value modifiers
    const meta = this.data.currentPhase.meta
    if (this.data.attacker.hitValueModifiers?.length) {
      applyStoredHitValueModifiers(
        modifiedDice.attacker,
        this.data.attacker.hitValueModifiers,
        meta,
      )
    }
    if (this.data.defender.hitValueModifiers?.length) {
      applyStoredHitValueModifiers(
        modifiedDice.defender,
        this.data.defender.hitValueModifiers,
        meta,
      )
    }

    // Clear dice for sides not in firing config
    // (abilities may inject dice for non-firing sides, e.g. attacker during SCD)
    if (!firing.includes('attacker')) modifiedDice.attacker = {}
    if (!firing.includes('defender')) modifiedDice.defender = {}

    this._logger?.child(this.data.currentPhase.meta).child('DICE_POOL').log({
      attacker: modifiedDice.attacker,
      defender: modifiedDice.defender,
    })

    return this.rollDiceOutcomes(
      modifiedDice,
      {
        attacker: this.side('attacker').getValidTargetsForPhase(this.data),
        defender: this.side('defender').getValidTargetsForPhase(this.data),
      },
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
    // Check that both sides have participating units before entering combat round
    if (noParticipatingUnits(this.data)) {
      return this.completeTransition()
    }

    const timings =
      round === 1
        ? (['START_OF_COMBAT_ROUND', 'START_OF_COMBAT'] as const)
        : (['START_OF_COMBAT_ROUND'] as const)
    this.runAbilities([...timings])

    // Re-check after abilities (e.g. Assault Cannon may destroy last ship)
    if (noParticipatingUnits(this.data)) {
      return this.completeTransition()
    }

    // In round 1 of SPACE_COMBAT, transition to AFB meta-phase
    if (round === 1 && this.data.currentPhase.meta === 'SPACE_COMBAT') {
      this.data.currentPhase = {
        meta: 'AFB',
        micro: getFirstMicroPhase('AFB'),
      }
      const state = CombatState.fromData(this.data, this._params)
      state._logger = this._logger
      return [{ state, probability: 1 }]
    }

    return this.transitionPhase()
  }

  private processDiceRoll(): StateWithProbability[] {
    // Check participating units (e.g. AFB may have destroyed last ship)
    if (noParticipatingUnits(this.data)) {
      return this.completeTransition()
    }

    const attackerDice = this.side('attacker').collectDice('COMBAT')
    const defenderDice = this.side('defender').collectDice('COMBAT')

    const sidedDiceData: SidedDiceData = {
      attacker: attackerDice,
      defender: defenderDice,
    }

    const modifiedDice = this.runAbilities('BEFORE_DICE_ROLL', sidedDiceData)

    // Apply stored hit-value modifiers (from ctx.api.own.modifyHitValue)
    const meta = this.data.currentPhase.meta
    if (this.data.attacker.hitValueModifiers?.length) {
      applyStoredHitValueModifiers(
        modifiedDice.attacker,
        this.data.attacker.hitValueModifiers,
        meta,
      )
    }
    if (this.data.defender.hitValueModifiers?.length) {
      applyStoredHitValueModifiers(
        modifiedDice.defender,
        this.data.defender.hitValueModifiers,
        meta,
      )
    }

    this._logger?.child(this.data.currentPhase.meta).child('DICE_POOL').log({
      attacker: modifiedDice.attacker,
      defender: modifiedDice.defender,
    })

    return this.rollDiceOutcomes(
      modifiedDice,
      {
        attacker: this.side('attacker').getValidTargetsForPhase(this.data),
        defender: this.side('defender').getValidTargetsForPhase(this.data),
      },
      'AFTER_DICE_ROLL',
    )
  }

  private processAssignHits(): StateWithProbability[] {
    this.assignHits()

    this.runAbilities('AFTER_ASSIGN_HITS_STEP')

    // If either side is completely wiped, go directly to COMPLETE
    if (
      !hasAnyUnits(this.data.attacker.units) ||
      !hasAnyUnits(this.data.defender.units)
    ) {
      return this.completeTransition()
    }

    return this.transitionPhase()
  }

  private processEndOfRound(): StateWithProbability[] {
    this.runAbilities('END_OF_COMBAT_ROUND')
    this.runAbilities('CLEANUP_ROUND')

    // Clear stored hit-value modifiers
    if (
      this.data.attacker.hitValueModifiers?.length ||
      this.data.defender.hitValueModifiers?.length
    ) {
      delete this.data.attacker.hitValueModifiers
      delete this.data.defender.hitValueModifiers
    }

    return this.transitionPhase()
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

    if (mod.unitId !== undefined) {
      // Target specific unit by UnitId
      for (const dice of Object.values(pool)) {
        if (!dice) continue
        for (let i = 0; i < dice.length; i++) {
          if (dice[i][2] === mod.unitId) {
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

/** Shallow-clone unitState record + each entry so ability mutations
 *  (e.g. SUSTAIN_DAMAGE setting isDamaged) don't leak across branches. */
function cloneUnitState(
  us: SideStateData['unitState'],
): SideStateData['unitState'] {
  // Fast path: empty unitState (e.g. fighters-only scenarios)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ in us) {
    // Has at least one key — need to clone
    const clone: SideStateData['unitState'] = {}
    for (const k in us) {
      const id = k as unknown as import('@/types').UnitId
      clone[id] = { ...us[id] }
    }
    return clone
  }
  return {}
}

/** Branch clone — copies hitPools + unitState per side.
 *  units arrays stay shared with base, which is safe because
 *  assignHits builds new arrays via slice (never mutates originals).
 *  unitState must be cloned because abilities like SUSTAIN_DAMAGE
 *  mutate entries (isDamaged) at BEFORE_ASSIGN_HITS — branches are
 *  processed sequentially, so earlier branches would corrupt later ones. */
function cloneStateForBranch(
  base: CombatStateData,
  nextPhase: PhaseIdentifier,
): CombatStateData {
  return {
    ...base,
    currentPhase: nextPhase,
    attacker: {
      ...base.attacker,
      hitPools: [...base.attacker.hitPools],
      unitState: cloneUnitState(base.attacker.unitState),
    },
    defender: {
      ...base.defender,
      hitPools: [...base.defender.hitPools],
      unitState: cloneUnitState(base.defender.unitState),
    },
  }
}

/** Add hits to data by mutating in-place */
function addHitsToData(
  data: CombatStateData,
  attackerHits: number,
  defenderHits: number,
  validTargets: { attacker: UnitType[]; defender: UnitType[] },
): void {
  // Defender's dice hit attacker
  if (defenderHits > 0) {
    data.attacker.hitPools.push({
      hits: defenderHits,
      validTargets: validTargets.attacker,
    })
  }
  // Attacker's dice hit defender
  if (attackerHits > 0) {
    data.defender.hitPools.push({
      hits: attackerHits,
      validTargets: validTargets.defender,
    })
  }
}

/** Check if either side lacks participating units for the current combat mode */
function noParticipatingUnits(data: CombatStateData): boolean {
  return (
    !hasParticipatingUnits(
      data.attacker.units,
      getParticipatingUnitsFromData(data, 'attacker'),
    ) ||
    !hasParticipatingUnits(
      data.defender.units,
      getParticipatingUnitsFromData(data, 'defender'),
    )
  )
}

/** Check if units record has any units at all (no type filtering) */
function hasAnyUnits(units: Record<string, unknown[]>): boolean {
  for (const key in units) {
    if (units[key].length > 0) return true
  }
  return false
}

/** Check if units record has any units of participating types (early exit) */
function hasParticipatingUnits(
  units: Record<string, unknown[]>,
  participatingUnits: ReadonlySet<UnitBaseType>,
): boolean {
  for (const key in units) {
    if (units[key].length <= 0) continue
    const { type } = parseVariantId(key as UnitType)
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

  return getParticipatingUnitsSet(units)
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

function getSideHash(side: SideStateData): string {
  // Build hash via string concatenation — avoids intermediate arrays
  let result = ''
  const keys = Object.keys(side.units)
  if (keys.length > 1) keys.sort()

  for (const key of keys) {
    const ids = side.units[key]
    const count = ids.length

    if (result) result += ','

    // Count damaged units by looking up each UnitId's state
    let damaged = 0
    if (key !== 'FIGHTER') {
      for (const id of ids) {
        if (side.unitState[id]?.isDamaged) damaged++
      }
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
  }

  return result
}
