import { GROUND_FORCES, STRUCTURES } from '@/constants/units'
import type {
  CombatSide,
  DiceGroup,
  UnitAbility,
  UnitBaseType,
  UnitType,
} from '@/types'

import {
  AbilitiesEngine,
  type AbilityTiming,
  cloneInvokes,
  type DicePool,
  type InvokeCollections,
  type RunAbilitiesOptions,
  type SidedDiceData,
  type TimingContextMap,
} from '../abilities-engine'
import {
  assignHitsForSide,
  CombatSideState,
  getAssignHitsParams,
  getOpponentSide,
  getParticipatingUnitsSet,
} from '../combat-side-state/combat-side-state'
import { type LogEntry, Logger } from '../logger'
import { parseVariantId } from '../utils'
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
  UnitAbilityMeta,
} from './types'
import { getCombinedDiceDistribution } from './utils'

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
    for (const [hitValue, baseDice, bonusDice] of units) {
      grouped.set(hitValue, (grouped.get(hitValue) ?? 0) + baseDice + bonusDice)
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
    abilities?: Record<
      import('@/types').CombatSide,
      import('../abilities-engine').Ability[]
    >,
    unitAbilityKeys?: Record<import('@/types').CombatSide, ReadonlySet<string>>,
    factionOwnedKeys?: Record<
      import('@/types').CombatSide,
      ReadonlySet<string>
    >,
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

    const emptyKeys = {
      attacker: new Set<string>(),
      defender: new Set<string>(),
    }

    instance.data = baseData
    instance._params = AbilitiesEngine.fromConfig(
      instance,
      abilities ?? { attacker: [], defender: [] },
      unitAbilityKeys ?? emptyKeys,
      factionOwnedKeys ?? emptyKeys,
    )

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

  public static fromDataStandalone(
    data: CombatStateData,
    abilities?: Record<
      import('@/types').CombatSide,
      import('../abilities-engine').Ability[]
    >,
    unitAbilityKeys?: Record<import('@/types').CombatSide, ReadonlySet<string>>,
    factionOwnedKeys?: Record<
      import('@/types').CombatSide,
      ReadonlySet<string>
    >,
  ): CombatState {
    const emptyKeys = {
      attacker: new Set<string>(),
      defender: new Set<string>(),
    }
    const instance = Object.create(CombatState.prototype) as CombatState
    instance.data = data
    instance._params = AbilitiesEngine.wrap(
      instance,
      abilities ?? { attacker: [], defender: [] },
      unitAbilityKeys ?? emptyKeys,
      factionOwnedKeys ?? emptyKeys,
    )
    return instance
  }

  private runAbilities<T extends AbilityTiming>(
    timing: T | T[],
    context?: TimingContextMap[T],
    options?: RunAbilitiesOptions,
  ): TimingContextMap[T] {
    this._params.setCombatState(this, this._logger)
    return this._params.runAbilities(
      timing,
      context,
      options,
      this._logger?.child(this.data.currentPhase.meta),
    )
  }

  assignHits(): void {
    const trackDestroyed = !!this._logger || this._params.hasDestroyAbilities()

    this.runAbilities('BEFORE_ASSIGN_HITS')

    // Pre-compute params once — avoids 2x redundant settings navigation
    const attackerParams = getAssignHitsParams(this.data, 'attacker')
    const defenderParams = getAssignHitsParams(this.data, 'defender')

    const attackerDestroyed = assignHitsForSide(
      this.data.attacker,
      attackerParams,
      trackDestroyed,
    )
    const defenderDestroyed = assignHitsForSide(
      this.data.defender,
      defenderParams,
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
        return this.handleBranchesOrContinue(() => this.transitionPhase())
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
    opts?: {
      overridePhase?: PhaseIdentifier
      routing?: { attacker: CombatSide; defender: CombatSide }
      firingSides?: CombatSide[]
    },
  ): StateWithProbability[] {
    const attackerDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.attacker),
    )
    const defenderDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.defender),
    )

    const nextPhase =
      opts?.overridePhase ?? getNextMicroPhase(this.data.currentPhase)
    const { meta: metaPhase } = this.data.currentPhase

    const results: StateWithProbability[] = []

    // Save baseline _invokes reference — COW protects it from mutation
    const baseInvokes = this._invokes

    // Check once whether after-roll abilities exist — avoids per-branch
    // deepCloneSides + runAbilities overhead when no abilities are registered.
    const runAfterRoll =
      afterRollTiming != null && this._params.hasCallableInvoke(afterRollTiming)

    // Loop-invariant: routing targets and after-roll options depend only on
    // opts, not on branch state. Hoist out of the per-branch dice loop.
    const attackerHitTarget = opts?.routing?.attacker ?? 'defender'
    const defenderHitTarget = opts?.routing?.defender ?? 'attacker'
    const afterOptions =
      runAfterRoll &&
      afterRollTiming === 'AFTER_UNIT_ABILITY_ROLL' &&
      opts?.firingSides
        ? buildUnitAbilityRunOptions(opts.firingSides, opts.routing, {
            firingOnly: true,
            timing: 'after',
          })
        : undefined

    const baseData = this.data

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        this._invokes = baseInvokes
        this._invokesOwned = false

        const branchData = cloneStateForBranch(baseData, nextPhase)
        addHitsToData(
          branchData,
          attOutcome.hits,
          defOutcome.hits,
          validTargets,
          opts?.routing,
        )

        const branchLogger = this._logger?.fork()
        branchLogger?.child(metaPhase).child('DICE_ROLL').log({
          attacker: attOutcome.hits,
          defender: defOutcome.hits,
        })
        let hitsToAttacker = 0
        let hitsToDefender = 0
        if (attackerHitTarget === 'attacker') hitsToAttacker += attOutcome.hits
        else hitsToDefender += attOutcome.hits
        if (defenderHitTarget === 'attacker') hitsToAttacker += defOutcome.hits
        else hitsToDefender += defOutcome.hits
        branchLogger?.child(metaPhase).child('DICE_HITS').log({
          attacker: hitsToAttacker,
          defender: hitsToDefender,
        })

        if (runAfterRoll) {
          this.data = branchData
          this._params.setCombatState(this, branchLogger)
          this._params.runAbilities(
            afterRollTiming!,
            undefined,
            afterOptions,
            branchLogger?.child(metaPhase),
          )

          // AFTER_DICE_ROLL / AFTER_UNIT_ABILITY_ROLL abilities may have
          // branched further (e.g. via rollDice or cascading assignHits).
          if (this._params.hasBranches()) {
            const subBranches = this._params.consumeBranches()
            for (const sub of subBranches) {
              const subState = CombatState.fromData(sub.data, this._params)
              subState._logger = sub.logger
              subState._invokes = sub.invokes
              subState._invokesOwned = true
              results.push({
                state: subState,
                probability: probability * sub.probability,
              })
            }
            continue
          }
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
    this.runAbilities('END_OF_COMBAT')

    return this.handleBranchesOrContinue(() => {
      this.data.currentPhase = {
        meta: 'COMPLETE' as const,
        micro: getLastMicroPhase('COMPLETE'),
      }
      const state = CombatState.fromData(this.data, this._params)
      state._logger = this._logger
      return [{ state, probability: 1 }]
    })
  }

  /**
   * If the most recent runAbilities call produced branches (via rollDice or
   * any cascading operation), run `continuation` once per branch with this
   * CombatState swapped to that branch's data/invokes/logger. Probabilities
   * returned by the continuation are multiplied by the branch's probability.
   * When no branching occurred, runs the continuation once on the current
   * state (equivalent to just calling it directly).
   */
  private handleBranchesOrContinue(
    continuation: () => StateWithProbability[],
  ): StateWithProbability[] {
    if (!this._params.hasBranches()) {
      return continuation()
    }

    const branches = this._params.consumeBranches()
    const results: StateWithProbability[] = []

    for (const branch of branches) {
      this.data = branch.data
      this._invokes = branch.invokes
      // Sibling branches may share the same `invokes` reference; mark as
      // unowned so the next mutation triggers COW and isolates this branch.
      this._invokesOwned = false
      this._logger = branch.logger

      const branchResults = continuation()
      for (const r of branchResults) {
        results.push({
          state: r.state,
          probability: r.probability * branch.probability,
        })
      }
    }

    return results
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

  /** Shared pre-roll pipeline for unit-ability phases. Runs block-check, dice
   *  collection (or custom-dice override), BEFORE_UNIT_ABILITY_ROLL, stored
   *  hit-value modifiers, and DICE_POOL logging. Returns `'ALL_BLOCKED'` when
   *  no firing side can act — caller decides how to short-circuit. */
  private prepareUnitAbilityDice(
    firing: CombatSide[],
    hitSource: HitSource,
    allowedUnitTypes?: ReadonlySet<UnitBaseType>,
    customDice?: SidedDiceData,
    routing?: { attacker: CombatSide; defender: CombatSide },
  ):
    | {
        modifiedDice: SidedDiceData
        validTargets: { attacker: UnitType[]; defender: UnitType[] }
      }
    | 'ALL_BLOCKED' {
    const blockedSides = firing.filter(side =>
      this.side(side).isAbilityBlocked(hitSource as UnitAbility),
    )
    if (blockedSides.length === firing.length) return 'ALL_BLOCKED'

    const attackerDice: DicePool = firing.includes('attacker')
      ? (customDice?.attacker ??
        this.side('attacker').collectDice(hitSource, allowedUnitTypes))
      : {}
    const defenderDice: DicePool = firing.includes('defender')
      ? (customDice?.defender ??
        this.side('defender').collectDice(hitSource, allowedUnitTypes))
      : {}

    const beforeOptions = buildUnitAbilityRunOptions(firing, routing, {
      timing: 'before',
    })
    if (blockedSides.length > 0) beforeOptions.skipSides = blockedSides
    const modifiedDice = this.runAbilities(
      'BEFORE_UNIT_ABILITY_ROLL',
      { attacker: attackerDice, defender: defenderDice },
      beforeOptions,
    )

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

    // Abilities may inject dice for non-firing sides (e.g. attacker during
    // SCD); drop those so only firing sides contribute to the roll.
    if (!firing.includes('attacker')) modifiedDice.attacker = {}
    if (!firing.includes('defender')) modifiedDice.defender = {}

    this._logger?.child(meta).child('DICE_POOL').log({
      attacker: modifiedDice.attacker,
      defender: modifiedDice.defender,
      hitSource,
    })

    return {
      modifiedDice,
      validTargets: {
        attacker: this.side('attacker').getValidTargetsForPhase(this.data),
        defender: this.side('defender').getValidTargetsForPhase(this.data),
      },
    }
  }

  private processUnitAbilityDiceRoll(
    config: UnitAbilityPhaseConfig,
  ): StateWithProbability[] {
    const { firing, hitSource, allowedUnitTypes } = config
    const prepared = this.prepareUnitAbilityDice(
      firing,
      hitSource,
      allowedUnitTypes,
    )
    if (prepared === 'ALL_BLOCKED') {
      this.data.currentPhase.micro = getLastMicroPhase(
        this.data.currentPhase.meta,
      )
      return this.transitionPhase()
    }
    return this.rollDiceOutcomes(
      prepared.modifiedDice,
      prepared.validTargets,
      'AFTER_UNIT_ABILITY_ROLL',
      { firingSides: firing },
    )
  }

  /** Run a full unit-ability step (DICE_ROLL + ASSIGN_HITS) from an ability
   *  at another timing. Temporarily sets `currentPhase.meta` to the step's
   *  meta so invoke-level `context` filters and hit-value modifiers match,
   *  then restores the outer phase on every resulting branch.
   *
   *  Used by AbilityContext.resolveStep. */
  public runUnitAbilityStepForAbility(config: {
    meta: UnitAbilityMeta
    firing: CombatSide[]
    hitSource: HitSource
    customDice?: SidedDiceData
    routing?: { attacker: CombatSide; defender: CombatSide }
  }): StateWithProbability[] {
    const { meta, firing, hitSource, customDice, routing } = config
    const outerPhase = this.data.currentPhase

    this.data.currentPhase = { meta, micro: 'DICE_ROLL' }

    const prepared = this.prepareUnitAbilityDice(
      firing,
      hitSource,
      undefined,
      customDice,
      routing,
    )
    if (prepared === 'ALL_BLOCKED') {
      this.data.currentPhase = outerPhase
      const state = CombatState.fromData(this.data, this._params)
      state._logger = this._logger
      return [{ state, probability: 1 }]
    }

    const diceRollBranches = this.rollDiceOutcomes(
      prepared.modifiedDice,
      prepared.validTargets,
      'AFTER_UNIT_ABILITY_ROLL',
      {
        overridePhase: { meta, micro: 'ASSIGN_HITS' },
        routing,
        firingSides: firing,
      },
    )

    const finalBranches: StateWithProbability[] = []

    for (const { state: branchCS, probability } of diceRollBranches) {
      this.data = branchCS.data
      this._invokes = branchCS._invokes
      this._invokesOwned = false
      this._logger = branchCS._logger
      this._params.setCombatState(this, this._logger)

      this.assignHits()

      const results = this.handleBranchesOrContinue(() => {
        this.runAbilities('AFTER_ASSIGN_HITS_STEP')
        return this.handleBranchesOrContinue(() => {
          clearPhaseScopedHitValueModifiers(this.data, meta)
          this.data.currentPhase = outerPhase
          const state = CombatState.fromData(this.data, this._params)
          state._logger = this._logger
          return [{ state, probability: 1 }]
        })
      })

      for (const r of results) {
        finalBranches.push({
          state: r.state,
          probability: probability * r.probability,
        })
      }
    }

    return finalBranches
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

    return this.handleBranchesOrContinue(() => {
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
    })
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
      hitSource: 'COMBAT',
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

    return this.handleBranchesOrContinue(() => {
      this.runAbilities('AFTER_ASSIGN_HITS_STEP')

      return this.handleBranchesOrContinue(() => {
        // Clear phase-scoped hit-value modifiers so they don't stack across
        // repeated phases (e.g. Bunker's -4 BOMBARDMENT modifier must apply
        // once per bombardment, not accumulate if multiple BOMBARDMENTs run).
        clearPhaseScopedHitValueModifiers(
          this.data,
          this.data.currentPhase.meta,
        )

        // If either side is completely wiped, go directly to COMPLETE
        if (
          !hasAnyUnits(this.data.attacker.units) ||
          !hasAnyUnits(this.data.defender.units)
        ) {
          return this.completeTransition()
        }

        return this.transitionPhase()
      })
    })
  }

  private processEndOfRound(): StateWithProbability[] {
    this.runAbilities('END_OF_COMBAT_ROUND')

    return this.handleBranchesOrContinue(() => {
      this.runAbilities('AFTER_COMBAT_ROUND')

      return this.handleBranchesOrContinue(() => {
        this.runAbilities('CLEANUP_ROUND')

        return this.handleBranchesOrContinue(() => {
          // Clear stored hit-value modifiers
          if (
            this.data.attacker.hitValueModifiers?.length ||
            this.data.defender.hitValueModifiers?.length
          ) {
            delete this.data.attacker.hitValueModifiers
            delete this.data.defender.hitValueModifiers
          }

          return this.transitionPhase()
        })
      })
    })
  }
}

/** Compute RunAbilitiesOptions for a unit-ability phase's BEFORE/AFTER
 *  unit-ability-roll abilities, based on who is firing and where their hits
 *  are routed. This implements "mimic side" semantics: `ctx.api.opponent`
 *  always points to the counterparty in the action regardless of the
 *  attacker/defender labels, so abilities (Bunker, X-89, etc.) don't need
 *  to know about custom routing.
 *
 *  Default remap (multi-firer phases, and AFTER_UNIT_ABILITY_ROLL):
 *   - `firing` role: opponent = target side (where this side's hits go)
 *   - `target`-only role: opponent = firing side
 *   - self-bombard (firing == target): opponent = self
 *   - `none` role: fall back to the natural opposite side
 *
 *  BEFORE_UNIT_ABILITY_ROLL in a single-firer phase (BOMBARDMENT,
 *  SPACE_CANNON_DEFENSE): every invoker's opponent is that firer. Dice-
 *  modifying abilities (Bunker, Antimass Deflectors) target the rolling pool
 *  uniformly, so they work whether the owner is defender-vs-attacker-bombing
 *  (normal case) or the owner themselves is firing via Proxima/Harrow.
 *
 *  When `firingOnly` is set, non-firing sides are skipped (used for
 *  AFTER_UNIT_ABILITY_ROLL — only the side that rolled should react). */
function buildUnitAbilityRunOptions(
  firing: readonly CombatSide[],
  routing?: { attacker: CombatSide; defender: CombatSide },
  flags: { firingOnly?: boolean; timing?: 'before' | 'after' } = {},
): RunAbilitiesOptions {
  const firingSet = new Set(firing)
  const targetOf = (side: CombatSide): CombatSide =>
    routing?.[side] ?? getOpponentSide(side)

  const targets = new Set<CombatSide>()
  for (const f of firing) targets.add(targetOf(f))

  const opponentFor = (side: CombatSide): CombatSide => {
    if (flags.timing === 'before' && firing.length === 1) return firing[0]
    if (firingSet.has(side)) return targetOf(side)
    if (targets.has(side)) {
      for (const f of firing) if (targetOf(f) === side) return f
    }
    return getOpponentSide(side)
  }

  const skipSides: CombatSide[] = []
  if (flags.firingOnly) {
    for (const side of ['attacker', 'defender'] as const) {
      if (!firingSet.has(side)) skipSides.push(side)
    }
  }

  return {
    opponentSideByInvokerSide: {
      attacker: opponentFor('attacker'),
      defender: opponentFor('defender'),
    },
    skipSides: skipSides.length > 0 ? skipSides : undefined,
  }
}

/** Drop hit-value modifiers scoped to a unit-ability phase meta after that
 *  phase completes, so they don't accumulate across repeated phases.
 *  Modifiers with COMBAT-phase contexts (SPACE_COMBAT / GROUND_COMBAT)
 *  persist to END_OF_COMBAT_ROUND. */
function clearPhaseScopedHitValueModifiers(
  data: CombatStateData,
  meta: MetaPhase,
): void {
  if (meta === 'SPACE_COMBAT' || meta === 'GROUND_COMBAT') return
  for (const side of ['attacker', 'defender'] as const) {
    const mods = data[side].hitValueModifiers
    if (!mods?.length) continue
    if (!mods.some(m => m.context === meta)) continue
    const keep = mods.filter(m => m.context !== meta)
    if (keep.length === 0) {
      delete data[side].hitValueModifiers
    } else {
      data[side].hitValueModifiers = keep
    }
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
          if (dice[i][3] === mod.unitId) {
            dice[i] = [
              Math.max(1, dice[i][0] + mod.amount),
              dice[i][1],
              dice[i][2],
              dice[i][3],
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
        dice[i] = [
          Math.max(1, dice[i][0] + mod.amount),
          dice[i][1],
          dice[i][2],
          dice[i][3],
        ]
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

/** Branch clone — copies hitPools, unitState, and abilities per side.
 *  units arrays stay shared with base — all mutation paths (assignHits,
 *  removeUnits) build new arrays instead of mutating originals.
 *  unitState must be cloned because abilities like SUSTAIN_DAMAGE
 *  mutate entries (isDamaged) at BEFORE_ASSIGN_HITS — branches are
 *  processed sequentially, so earlier branches would corrupt later ones.
 *  abilities must be cloned because abilities like DIRECT_HIT decrement
 *  `uses` — shared config would leak decrements across branches. */
export function cloneStateForBranch(
  base: CombatStateData,
  nextPhase: PhaseIdentifier,
): CombatStateData {
  return {
    ...base,
    currentPhase: nextPhase,
    abilities: base.abilities,
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

/** Add hits to data by mutating in-place.
 *  `routing` maps firing side → target side. Defaults: attacker → defender,
 *  defender → attacker. `validTargets` is keyed by target side. */
function addHitsToData(
  data: CombatStateData,
  attackerHits: number,
  defenderHits: number,
  validTargets: { attacker: UnitType[]; defender: UnitType[] },
  routing?: { attacker: CombatSide; defender: CombatSide },
): void {
  const defenderHitsTarget = routing?.defender ?? 'attacker'
  const attackerHitsTarget = routing?.attacker ?? 'defender'
  if (defenderHits > 0) {
    data[defenderHitsTarget].hitPools.push({
      hits: defenderHits,
      validTargets: validTargets[defenderHitsTarget],
    })
  }
  if (attackerHits > 0) {
    data[attackerHitsTarget].hitPools.push({
      hits: attackerHits,
      validTargets: validTargets[attackerHitsTarget],
    })
  }
}

/** Check if either side lacks participating units for the current combat mode */
function noParticipatingUnits(data: CombatStateData): boolean {
  const mode = data.combatMode
  const key =
    mode === 'GROUND' ? 'groundCombatParticipating' : 'spaceCombatParticipating'

  for (const side of ['attacker', 'defender'] as const) {
    const settings = data.abilities[side]['SETTINGS']
    if (!settings) return true

    const participating = getParticipatingUnitsSet(
      settings[key] as UnitBaseType[],
    )
    if (!hasParticipatingUnits(data[side].units, participating)) return true
  }
  return false
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
