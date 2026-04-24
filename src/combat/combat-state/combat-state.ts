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
  type AbilityBranch,
  AbilityBranchInterrupt,
  cloneInvokes,
  cloneTracker,
  type DicePool,
  type InvokeCollections,
  type RunAbilitiesOptions,
  type SidedDiceData,
} from '../abilities-engine'
import {
  assignHitsForSide,
  CombatSideState,
  getOpponentSide,
} from '../combat-side-state/combat-side-state'
import { type LogEntry, Logger } from '../logger'
import { sortUnitsByPriority } from '../utils/sort-units-by-priority'
import type {
  CombatMode,
  CombatStateData,
  DiceRollContext,
  HitSource,
  HitValueModifier,
  MetaPhase,
  PendingStep,
  PhaseStep,
  PhaseStepGroup,
  SideAbilitiesConfig,
  SideStateData,
  UnitAbilityMeta,
} from './types'
import { isDiceRollContext } from './types'
import { getCombinedDiceDistribution } from './utils'

/** A state with its probability */
export interface StateWithProbability {
  state: CombatState
  probability: number
}

/** Innermost meta in a phase stack. Used for logger children, hit-value
 *  modifier scoping, and unit-ability config selection — they all key on the
 *  most deeply nested meta (e.g. 'AFB' when the stack is ['SPACE_COMBAT', 'AFB']). */
function innerMeta(phase: MetaPhase[]): MetaPhase {
  return phase[phase.length - 1]
}

function sortUnitsAtSetup(data: CombatStateData): void {
  const mode = data.combatMode
  for (const side of ['attacker', 'defender'] as const) {
    // Merge base + live SETTINGS and UNIT_PRIORITY — PREPARE may have
    // written derived fields (Hel Titan → groundCombatParticipating
    // includes PDS) into liveAbilities.
    const baseSide = data[side].abilities
    const liveSide = data[side].liveAbilities

    const baseUP = baseSide['UNIT_PRIORITY']
    const liveUP = liveSide['UNIT_PRIORITY']
    const unitPriority = (
      liveUP === undefined
        ? baseUP
        : baseUP === undefined
          ? liveUP
          : { ...baseUP, ...liveUP }
    ) as
      | { spaceUnitPriority?: UnitType[]; groundUnitPriority?: UnitType[] }
      | undefined

    const list =
      mode === 'GROUND'
        ? unitPriority?.groundUnitPriority
        : unitPriority?.spaceUnitPriority
    if (!list) continue

    // Membership comes from SETTINGS.{space,ground}CombatParticipating
    // — the authoritative runtime field. UNIT_PRIORITY only dictates
    // order; it's synced from an extended "source" view and may list
    // variants/types that aren't currently participating.
    const baseSettings = baseSide['SETTINGS']
    const liveSettings = liveSide['SETTINGS']
    const settings = (
      liveSettings === undefined
        ? baseSettings
        : baseSettings === undefined
          ? liveSettings
          : { ...baseSettings, ...liveSettings }
    ) as
      | {
          spaceCombatParticipating?: UnitBaseType[]
          groundCombatParticipating?: UnitBaseType[]
        }
      | undefined
    const partList =
      mode === 'GROUND'
        ? settings?.groundCombatParticipating
        : settings?.spaceCombatParticipating
    const participatingTypes = partList ? new Set(partList) : undefined

    sortUnitsByPriority(data[side], list, participatingTypes)
  }
}

interface UnitAbilityPhaseConfig {
  firing: CombatSide[]
  hitSource: HitSource
  allowedUnitTypes?: ReadonlySet<UnitBaseType>
}

/** True when neither side has any dice entries — a unit-ability phase with
 *  no firing units and no ability-injected dice should skip its ASSIGN_HITS
 *  tail entirely, since there can be no hits to resolve. */
function isDicePoolEmpty(dice: SidedDiceData): boolean {
  return isSidePoolEmpty(dice.attacker) && isSidePoolEmpty(dice.defender)
}

function isSidePoolEmpty(pool: DicePool): boolean {
  for (const entries of Object.values(pool)) {
    if (entries && entries.length > 0) return false
  }
  return true
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
  /** LIFO stack of steps for the current meta's phase script. `advance()`
   *  pops one step per call. Stored in reverse execution order so `.pop()`
   *  yields the next-to-execute step. Instance-level (not on `data`) because
   *  steps hold direct method references that can't go through structuredClone.
   *
   *  Entries are either standalone `PhaseStep`s or `PhaseStepGroup`s whose
   *  inner steps share a context (e.g. the destroyed-units map driving a
   *  DESTROY / WHEN_DESTROY / AFTER_DESTROY cascade). Inside a group, the
   *  innermost step at `steps.at(-1)` is the next to execute; when the
   *  group's steps drain, the group is removed and its context released. */
  public pendingSteps: PendingStep[] = []

  /** The timing step currently dispatching a `runAbilities` pass, or
   *  `undefined` outside a dispatch (PREPARE, tests, between steps). Derived
   *  from `pendingSteps` by walking from the top and returning the innermost
   *  timing step — skipping groups whose innermost pending step is a method
   *  (e.g. a freshly-pushed dice-roll group whose `_collectDice` hasn't run
   *  yet). Exposed so the abilities engine can read the phase stack and
   *  park-state slot without plumbing them through its public API. */
  get currentStep(): Extract<PhaseStep, { kind: 'timing' }> | undefined {
    for (let i = this.pendingSteps.length - 1; i >= 0; i--) {
      const entry = this.pendingSteps[i]
      const step = entry.kind === 'group' ? entry.steps.at(-1) : entry
      if (step?.kind === 'timing') return step
    }
    return undefined
  }

  get log(): LogEntry[] | undefined {
    return this._logger?.entries as LogEntry[] | undefined
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

  abilitiesFor(side: CombatSide): SideAbilitiesConfig {
    return this.data[side].abilities
  }

  liveAbilitiesFor(side: CombatSide): SideAbilitiesConfig {
    return this.data[side].liveAbilities
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
    const instance = Object.create(CombatState.prototype) as CombatState

    const baseData: CombatStateData = {
      attacker,
      defender,
      combatMode,
    }

    const emptyKeys = {
      attacker: new Set<string>(),
      defender: new Set<string>(),
    }

    instance.data = baseData
    instance.pendingSteps = []
    instance._params = AbilitiesEngine.fromConfig(
      instance,
      abilities ?? { attacker: [], defender: [] },
      unitAbilityKeys ?? emptyKeys,
      factionOwnedKeys ?? emptyKeys,
    )

    // PREPARE abilities mutate baseData in-place
    instance._params.runAbilities('PREPARE')

    // One-time sort: filter `units[]` to participating-only and order by
    // combat-mode priority rank. Never re-sorted during combat in iteration 1.
    sortUnitsAtSetup(baseData)

    return instance
  }

  public static fromData(
    data: CombatStateData,
    params: AbilitiesEngine,
  ): CombatState {
    const instance = Object.create(CombatState.prototype) as CombatState
    instance.data = data
    instance.pendingSteps = []
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
    instance.pendingSteps = []
    instance._params = AbilitiesEngine.wrap(
      instance,
      abilities ?? { attacker: [], defender: [] },
      unitAbilityKeys ?? emptyKeys,
      factionOwnedKeys ?? emptyKeys,
    )
    return instance
  }

  assignHits(phase: MetaPhase[]): void {
    this.pushScript(this.getAssignHitsScript(phase))
  }

  isFinished(): boolean {
    return this.data.isFinished === true
  }

  getAssignHitsScript(phase: MetaPhase[]): PhaseStep[] {
    return [
      {
        kind: 'timing',
        timing: 'BEFORE_ASSIGN_HITS',
        phase,
      },
      {
        kind: 'method',
        fn: CombatState.prototype._applyHitAssignmentStep,
        phase,
      },
    ]
  }

  getUnitsHash(): string {
    return `${getSideHash(this.data.attacker)}|${getSideHash(this.data.defender)}`
  }

  getHash(): string {
    const a = getSideLiveAbilitiesHash(this.data.attacker.liveAbilities)
    const d = getSideLiveAbilitiesHash(this.data.defender.liveAbilities)
    const combined = !a && !d ? '' : `a{${a}}d{${d}}`
    return `${this.getUnitsHash()}|${combined}`
  }

  /**
   * Phase state machine driver: pops and executes steps from
   * `pendingSteps` until one of: (a) a step branches, (b) `pendingSteps`
   * drains, (c) `isFinished()` becomes true, or (d) `stopAt` matches the
   * next step. Deterministic runs return `[{ state: this, probability: 1 }]`
   * — literally `this`, no allocation.
   *
   * The caller (combat-engine / test harness) owns phase flow — it must
   * explicitly `loadPhaseScript()` before calling `advance()` on an empty
   * stack, and must resolve transitions (via the flow arrays /
   * `transitionTarget`) between scripts.
   */
  public advance(
    enableLog = false,
    stopAt?: (step: PhaseStep) => boolean,
  ): StateWithProbability[] {
    if (enableLog && !this._logger) {
      this._logger = Logger.create()
    }

    while (this.pendingSteps.length > 0 && !this.isFinished()) {
      const top = this.pendingSteps.at(-1)!
      const step: PhaseStep = top.kind === 'group' ? top.steps.at(-1)! : top
      const groupData: unknown | undefined =
        top.kind === 'group' ? top.data : undefined

      if (stopAt?.(step)) {
        return [{ state: this, probability: 1 }]
      }

      if (step.kind === 'timing') {
        const data = step.data !== undefined ? step.data : groupData
        const branches = this._runTimingStep(step, data)
        if (branches !== undefined) return branches
        // Parked (pass wrote a frame back) — leave the step in place so the
        // next iteration re-peeks it. `stopAt` may match on the resume path.
        if (step.frame) continue
        this._popTopStep()
        continue
      }

      this._popTopStep()
      const result = step.fn.call(this, step.phase, step.payload)
      if (result !== undefined) return result
    }

    return [{ state: this, probability: 1 }]
  }

  /** Pop the current pending step from the top of the stack. If the top is
   *  a group, pop its innermost step; when the group drains, remove it. */
  private _popTopStep(): void {
    const top = this.pendingSteps[this.pendingSteps.length - 1]
    if (top.kind === 'group') {
      top.steps.pop()
      if (top.steps.length === 0) this.pendingSteps.pop()
    } else {
      this.pendingSteps.pop()
    }
  }

  /** Return the `PhaseStep` that `advance()` will dispatch next, or
   *  `undefined` when the stack is empty. Groups are transparent to
   *  callers — the unwrapped inner step is returned. Used by the test
   *  harness and engine consumers that inspect what's about to run. */
  public peekStep(): PhaseStep | undefined {
    const top = this.pendingSteps.at(-1)
    if (!top) return undefined
    if (top.kind === 'group') return top.steps.at(-1)
    return top
  }

  /** `data` of the top-of-stack `PhaseStepGroup`, or `undefined` when
   *  the top entry is a standalone step (or the stack is empty). Exposed
   *  so API layers (e.g. `AbilityContext.getDicePool`) can reach the
   *  current script data without plumbing. */
  get currentGroupData(): unknown {
    const top = this.pendingSteps.at(-1)
    return top?.kind === 'group' ? top.data : undefined
  }

  /** Populate `pendingSteps` with the full script for the given meta.
   *  Called by combat-engine / the test harness when the stack is empty
   *  and combat is still ongoing. Stored in reverse execution order. */
  public loadPhaseScript(meta: MetaPhase, round: number): void {
    const script = this.getPhaseScript(meta, round)
    // Reverse so pop() yields execution order.
    this.pendingSteps = script.slice().reverse()
  }

  /** One script per meta — defines the ordered steps a single round (or
   *  full traversal, for non-combat metas) will run through. Written in
   *  execution order for readability; `loadPhaseScript` reverses for the
   *  LIFO stack. When the script drains, the engine advances to the next
   *  meta. Round-selection for SPACE_COMBAT/GROUND_COMBAT uses the `round`
   *  argument — the caller (combat-engine / test harness) owns it. */
  public getPhaseScript(
    meta: MetaPhase,
    round: number,
    parentMeta?: MetaPhase[],
  ): PendingStep[] {
    const phase: MetaPhase[] = parentMeta ? [...parentMeta, meta] : [meta]
    switch (meta) {
      case 'SPACE_CANNON_OFFENSE':
      case 'AFB':
      case 'BOMBARDMENT':
      case 'SPACE_CANNON_DEFENSE': {
        const abilityConfig = this._getUnitAbilityConfig(meta)
        return [
          buildUnitAbilityDiceRollGroup(phase, abilityConfig),
          ...this.getAssignHitsScript(phase),
          { kind: 'timing', timing: 'AFTER_ASSIGN_HITS_STEP', phase },
          {
            kind: 'method',
            fn: CombatState.prototype._postAssignHits,
            phase,
          },
        ]
      }

      case 'SPACE_COMBAT':
      case 'GROUND_COMBAT': {
        return [
          {
            kind: 'timing',
            timing: round === 1 ? 'START_OF_COMBAT' : 'START_OF_COMBAT_ROUND',
            phase,
          },
          ...(meta === 'SPACE_COMBAT' && round === 1
            ? this.getPhaseScript('AFB', round, phase)
            : []),
          { kind: 'timing', timing: 'ANNOUNCE_RETREAT_STEP', phase },
          buildCombatDiceRollGroup(phase),
          ...this.getAssignHitsScript(phase),
          { kind: 'timing', timing: 'AFTER_ASSIGN_HITS_STEP', phase },
          {
            kind: 'method',
            fn: CombatState.prototype._postAssignHits,
            phase,
          },
          { kind: 'timing', timing: 'RETREAT_STEP', phase },
          { kind: 'timing', timing: 'END_OF_COMBAT_ROUND', phase },
          { kind: 'timing', timing: 'AFTER_COMBAT_ROUND', phase },
          { kind: 'timing', timing: 'CLEANUP_ROUND', phase },
          // Second wipe-check: catches abilities that destroy units after the
          // first `_postAssignHits` (e.g. EXOTRIREME wiping the opponent in
          // AFTER_COMBAT_ROUND). Without this the round drains, the engine
          // loops to round N+1, and ability CLEANUPs (e.g. CAVALRY) don't
          // fire until that next round's `_postAssignHits`.
          {
            kind: 'method',
            fn: CombatState.prototype._postAssignHits,
            phase,
          },
        ]
      }

      case 'COMMIT_UNITS':
        return [{ kind: 'timing', timing: 'COMMIT_UNITS', phase }]
    }
  }

  /** Execute a timing step — a single runAbilities call. Returns branches on
   *  ability-pass interrupt, otherwise `undefined`. `advance()` inspects
   *  `step.frame` afterwards to tell whether the pass parked. */
  private _runTimingStep(
    step: Extract<PhaseStep, { kind: 'timing' }>,
    data: unknown | undefined,
  ): StateWithProbability[] | undefined {
    this._params.setCombatState(this, this._logger)

    try {
      this._params.runAbilities(
        step.timing,
        data as never,
        step.options,
        this._logger?.child(innerMeta(step.phase)),
      )
    } catch (e) {
      if (!(e instanceof AbilityBranchInterrupt)) throw e
      return this._branchesToStates(e.branches)
    }
    return undefined
  }

  // ===========================================================================
  // STEP METHODS (referenced by PhaseStep entries in getPhaseScript)
  // ===========================================================================

  /** After ASSIGN_HITS completes: trigger completion if either side is
   *  wiped; otherwise return so the script continues draining. Combat metas
   *  (SPACE_COMBAT / GROUND_COMBAT / AFB) have further steps queued;
   *  non-combat metas drain to empty and the engine picks up the transition. */
  private _postAssignHits(phase: MetaPhase[]): void {
    const meta = innerMeta(phase)
    // Unit-ability phases (BOMBARDMENT / SCD / AFB / SCO) must let later
    // phases run even when the phase wiped a side's participants — e.g. PDS
    // still fires in SCD after bombardment clears ground forces. Only the
    // combat-round metas can shortcut on missing participants.
    const isCombatRound = meta === 'SPACE_COMBAT' || meta === 'GROUND_COMBAT'
    const attackerOut = isCombatRound
      ? !this.side('attacker').hasParticipatingUnits()
      : !hasAnyUnits(this.data.attacker)
    const defenderOut = isCombatRound
      ? !this.side('defender').hasParticipatingUnits()
      : !hasAnyUnits(this.data.defender)

    let winner: CombatSide | 'draw' | undefined
    if (attackerOut && defenderOut) winner = 'draw'
    else if (attackerOut) winner = 'defender'
    else if (defenderOut) winner = 'attacker'

    if (winner !== undefined) this._triggerCompletion(phase, winner)
  }

  private _setComplete(): void {
    this.data.isFinished = true
  }

  /** Re-split participating vs non-participating units for one side.
   *  SETTINGS.{space,ground}CombatParticipating is the authoritative
   *  "is this base type in combat?" source — UNIT_PRIORITY is used for
   *  ordering only (it can lag behind SETTINGS mid-combat because
   *  `declareParam` source sync runs only at reconcile). Called by
   *  `updateAbilityConfig` when a participation-affecting ability param
   *  changes. */
  public resyncParticipating(side: CombatSide): void {
    const data = this.data
    const liveSide = data[side].liveAbilities
    const baseSide = data[side].abilities

    const liveSettings = liveSide['SETTINGS']
    const baseSettings = baseSide['SETTINGS']
    const settings =
      liveSettings === undefined
        ? baseSettings
        : baseSettings === undefined
          ? liveSettings
          : { ...baseSettings, ...liveSettings }
    if (!settings) return
    const partList =
      data.combatMode === 'GROUND'
        ? (settings.groundCombatParticipating as UnitBaseType[] | undefined)
        : (settings.spaceCombatParticipating as UnitBaseType[] | undefined)
    if (!partList) return
    const participatingTypes = new Set<UnitBaseType>(partList)

    const liveUP = liveSide['UNIT_PRIORITY']
    const baseUP = baseSide['UNIT_PRIORITY']
    const unitPriority =
      liveUP === undefined
        ? baseUP
        : baseUP === undefined
          ? liveUP
          : { ...baseUP, ...liveUP }
    const orderList =
      (unitPriority &&
        ((data.combatMode === 'GROUND'
          ? unitPriority.groundUnitPriority
          : unitPriority.spaceUnitPriority) as UnitType[] | undefined)) ??
      (partList as unknown as UnitType[])

    sortUnitsByPriority(data[side], orderList, participatingTypes)
  }

  /** Replace any in-flight pending steps with the completion sequence and
   *  set `winnerSide` if not already set. The first caller (e.g. an
   *  ability's `transitionTo` pinning a 'draw') wins — later wipe-checks
   *  won't overwrite an explicit decision. After this, combat-state owns
   *  the path to `_setComplete`; the engine and test harness only observe
   *  via `isFinished`. Stored reversed (pop yields END_OF_COMBAT first). */
  public _triggerCompletion(
    phase: MetaPhase[],
    winner: CombatSide | 'draw',
  ): void {
    if (this.data.winnerSide === undefined) {
      this.data.winnerSide = winner
    }
    this.pendingSteps = []
    this.pushScript([
      { kind: 'timing', timing: 'END_OF_COMBAT', phase },
      { kind: 'timing', timing: 'CLEANUP_ROUND', phase },
      { kind: 'timing', timing: 'CLEANUP', phase },
      {
        kind: 'method',
        fn: CombatState.prototype._setComplete,
        phase,
      },
    ])
  }

  private pushScript(entity: PendingStep[]) {
    this.pendingSteps.push(...entity.reverse())
  }
  /** Apply pending hit pools deterministically. When destroyed units need
   *  tracking (logger attached or destroy-timing abilities registered), logs
   *  the destroyed context and pushes a destroy-cascade group onto
   *  `pendingSteps`. Otherwise returns early for speed.
   *
   *  Script-based cascade: the group carries the destroyed-units map as
   *  shared context. When called from an ability (via `assignHits`), the
   *  outer pass is parked by `tryResolveOne` on return and the cascade
   *  drains before the pass resumes. When called as a script step, the
   *  group runs before the rest of the remaining script. */
  private _applyHitAssignmentStep(phase: MetaPhase[]): void {
    const trackDestroyed =
      !!this._logger || this._params.hasDestroyAbilities(this._invokes)

    const meta = innerMeta(phase)
    const attackerPriority = getPhasePriorityList(this.data, 'attacker', meta)
    const defenderPriority = getPhasePriorityList(this.data, 'defender', meta)
    const attackerDestroyed = assignHitsForSide(
      this.data.attacker,
      trackDestroyed,
      attackerPriority,
    )
    const defenderDestroyed = assignHitsForSide(
      this.data.defender,
      trackDestroyed,
      defenderPriority,
    )

    if (!trackDestroyed) return

    const destroyedContext = {
      attacker: attackerDestroyed,
      defender: defenderDestroyed,
    }

    this._logger?.child(meta).child('ASSIGN_HITS').log(destroyedContext)

    const hasDestroyed =
      Object.keys(destroyedContext.attacker).length > 0 ||
      Object.keys(destroyedContext.defender).length > 0

    if (hasDestroyed) {
      this.pendingSteps.push(buildDestroyGroup(destroyedContext, phase))
    }
  }

  /** Populate a dice-roll group's context. For unit-ability phases:
   *  check block state and short-circuit when every firing side is
   *  blocked (drop this meta's script); if some sides are blocked,
   *  extend the BEFORE timing step's `options.skipSides`. Then collect
   *  each firing side's dice (or use `customDice` if provided) and
   *  store `dicePool` / `validTargets` on the group context. */
  _collectDice(phase: MetaPhase[]): void {
    const ctx = this.currentGroupData
    if (!isDiceRollContext(ctx)) {
      throw new Error('_collectDice called outside a dice-roll group')
    }

    if (ctx.isUnitAbility) {
      const blocked = ctx.firing.filter(side =>
        this.side(side).isAbilityBlocked(ctx.hitSource as UnitAbility),
      )
      if (blocked.length === ctx.firing.length) {
        this._discardCurrentMetaScript(phase)
        return
      }
      if (blocked.length > 0) {
        // Extend BEFORE timing's skipSides. Precedent: runUnitAbilityStepForAbility
        // used to mutate the DICE_ROLL step's payload.
        const top = this.pendingSteps.at(-1)!
        if (top.kind === 'group') {
          const beforeStep = top.steps.at(-1)
          if (beforeStep?.kind === 'timing') {
            beforeStep.options = {
              ...beforeStep.options,
              skipSides: blocked,
            }
          }
        }
      }
    }

    const attackerDice: DicePool = ctx.firing.includes('attacker')
      ? (ctx.customDice?.attacker ??
        this.side('attacker').collectDice(ctx.hitSource, ctx.allowedUnitTypes))
      : {}
    const defenderDice: DicePool = ctx.firing.includes('defender')
      ? (ctx.customDice?.defender ??
        this.side('defender').collectDice(ctx.hitSource, ctx.allowedUnitTypes))
      : {}

    ctx.dicePool = { attacker: attackerDice, defender: defenderDice }
    // validTargets deferred to _rollDice so BEFORE_UNIT_ABILITY_ROLL abilities
    // (e.g. WAYLAY expanding targets, EIDOLON_MAXIMUM removing MECH) can
    // affect SETTINGS before targets are computed.
  }

  /** Read the populated dice pool, apply stored hit-value modifiers,
   *  log DICE_POOL, and branch by outcome. Each resulting branch
   *  inherits the group (with AFTER timing still inside), so
   *  AFTER_(UNIT_ABILITY_)?DICE_ROLL runs per-branch as the next
   *  script step. */
  _rollDice(phase: MetaPhase[]): StateWithProbability[] | void {
    const ctx = this.currentGroupData
    if (!isDiceRollContext(ctx) || !ctx.dicePool) {
      throw new Error('_rollDice called without a populated dice-roll context')
    }

    const modifiedDice = ctx.dicePool
    const meta = innerMeta(phase)

    // Compute validTargets here (after BEFORE_UNIT_ABILITY_ROLL) so that
    // abilities which modify SETTINGS (e.g. WAYLAY, EIDOLON_MAXIMUM) are
    // reflected in target resolution before we branch by outcome.
    // Only unit-ability rolls need target restrictions; regular combat rolls
    // (SPACE_COMBAT / GROUND_COMBAT) leave validTargets empty so hit
    // assignment uses the fast tail-slice path.
    const validTargets = ctx.isUnitAbility
      ? {
          attacker: this.side('attacker').getValidTargetsForPhase(meta),
          defender: this.side('defender').getValidTargetsForPhase(meta),
        }
      : { attacker: [], defender: [] }

    const attackerModifiers = ctx.hitValueModifiers?.attacker
    if (attackerModifiers?.length) {
      applyStoredHitValueModifiers(modifiedDice.attacker, attackerModifiers)
    }
    const defenderModifiers = ctx.hitValueModifiers?.defender
    if (defenderModifiers?.length) {
      applyStoredHitValueModifiers(modifiedDice.defender, defenderModifiers)
    }

    if (ctx.isUnitAbility) {
      // Abilities may have injected dice for non-firing sides during
      // BEFORE_UNIT_ABILITY_ROLL; drop them so only firing sides roll.
      if (!ctx.firing.includes('attacker')) modifiedDice.attacker = {}
      if (!ctx.firing.includes('defender')) modifiedDice.defender = {}

      if (isDicePoolEmpty(modifiedDice)) {
        // Nothing to roll — skip the rest of this meta's script so
        // ASSIGN_HITS doesn't run for non-existent hits.
        this._discardCurrentMetaScript(phase)
        return
      }
    }

    this._logger?.child(meta).child('DICE_POOL').log({
      attacker: modifiedDice.attacker,
      defender: modifiedDice.defender,
      hitSource: ctx.hitSource,
    })

    return this.rollDiceOutcomes(modifiedDice, validTargets, phase, ctx.routing)
  }

  /** Convert engine-produced branches (each with its own data/invokes)
   *  into StateWithProbability entries for combat-engine. Each branch
   *  gets a per-branch copy of `pendingSteps`: either the branch's own
   *  continuation (for branches that pushed script state from inside a
   *  rollDice callback) or a clone of the current stack. Parked ability
   *  pass state travels with the cloned steps via `PhaseStep.frame`. */
  private _branchesToStates(branches: AbilityBranch[]): StateWithProbability[] {
    const remainder = this.pendingSteps
    return branches.map(b => {
      const state = CombatState.fromData(b.data, this._params)
      state._logger = b.logger
      state._invokes = b.invokes
      state._invokesOwned = false
      state.pendingSteps = clonePendingSteps(b.pendingSteps ?? remainder)
      return { state, probability: b.probability }
    })
  }

  /** Branch by dice-outcome: for each (attacker, defender) combination,
   *  clone state, add hits, log, and push a branch. Each branch inherits
   *  the caller's `pendingSteps` — the dice-roll group's AFTER timing
   *  step (if any) lands on every branch and runs per-branch through
   *  the normal script-dispatch machinery. */
  private rollDiceOutcomes(
    modifiedDice: SidedDiceData,
    validTargets: { attacker: UnitType[]; defender: UnitType[] },
    phase: MetaPhase[],
    routing?: { attacker: CombatSide; defender: CombatSide },
  ): StateWithProbability[] {
    const attackerDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.attacker),
    )
    const defenderDist = getCombinedDiceDistribution(
      flattenDicePool(modifiedDice.defender),
    )

    const metaPhase = innerMeta(phase)
    const results: StateWithProbability[] = []
    const baseInvokes = this._invokes
    const baseData = this.data
    const basePendingSteps = this.pendingSteps

    const attackerHitTarget = routing?.attacker ?? 'defender'
    const defenderHitTarget = routing?.defender ?? 'attacker'

    for (const attOutcome of attackerDist) {
      for (const defOutcome of defenderDist) {
        const probability = attOutcome.probability * defOutcome.probability
        if (probability === 0) continue

        this._invokes = baseInvokes
        this._invokesOwned = false

        const branchData = cloneStateForBranch(baseData)
        addHitsToData(
          branchData,
          attOutcome.hits,
          defOutcome.hits,
          validTargets,
          routing,
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

        const branchState = CombatState.fromData(branchData, this._params)
        branchState._logger = branchLogger
        branchState.pendingSteps = clonePendingSteps(basePendingSteps)
        results.push({ state: branchState, probability })
      }
    }

    this.pendingSteps = basePendingSteps
    this._invokes = baseInvokes
    this._invokesOwned = true

    return results
  }

  /** Derive the unit-ability firing config from the given meta. */
  private _getUnitAbilityConfig(meta: MetaPhase): UnitAbilityPhaseConfig {
    switch (meta) {
      case 'SPACE_CANNON_OFFENSE':
        return { firing: ['attacker', 'defender'], hitSource: 'SPACE_CANNON' }
      case 'AFB':
        return { firing: ['attacker', 'defender'], hitSource: 'AFB' }
      case 'BOMBARDMENT':
        return { firing: ['attacker'], hitSource: 'BOMBARDMENT' }
      case 'SPACE_CANNON_DEFENSE':
        return {
          firing: ['defender'],
          hitSource: 'SPACE_CANNON',
          allowedUnitTypes: new Set([...GROUND_FORCES, ...STRUCTURES]),
        }
      default:
        throw new Error(`Unexpected meta for unit-ability dice roll: ${meta}`)
    }
  }

  /** Pop pending steps that belong to the given phase (reference-equal
   *  phase array from the same getPhaseScript emission). For standalone
   *  metas this empties the stack; for a nested meta (AFB inside
   *  SPACE_COMBAT), the outer script's steps — which carry a different
   *  phase array — survive. Groups are homogeneous (all inner steps share
   *  a phase), so checking the group's next-to-run step is sufficient. */
  private _discardCurrentMetaScript(phase: MetaPhase[]): void {
    while (this.pendingSteps.length > 0) {
      const top = this.pendingSteps[this.pendingSteps.length - 1]
      const topPhase =
        top.kind === 'group'
          ? top.steps[top.steps.length - 1]?.phase
          : top.phase
      if (topPhase !== phase) break
      this.pendingSteps.pop()
    }
  }

  /** Queue a full unit-ability step (DICE_ROLL + ASSIGN_HITS) as nested
   *  script entries. Called from `AbilityContext.resolveStep`: the outer
   *  ability is inside a script-driven pass, so after its `call` returns
   *  the engine parks the pass (pendingSteps grew) and `advance()`
   *  dispatches the pushed step(s) before the outer pass resumes.
   *
   *  The group carries firing-side restriction, optional custom dice,
   *  and optional hit routing (e.g. `target: 'OWN'` self-damage).
   *  Everything else (BEFORE/AFTER ASSIGN_HITS, destroy cascade,
   *  completion check) flows through the standard phase script. */
  public runUnitAbilityStepForAbility(config: {
    meta: UnitAbilityMeta
    firing: CombatSide[]
    outerPhase: MetaPhase[]
    customDice?: SidedDiceData
    routing?: { attacker: CombatSide; defender: CombatSide }
  }): void {
    const { meta, firing, outerPhase, customDice, routing } = config
    const phase: MetaPhase[] = [...outerPhase, meta]
    const baseConfig = this._getUnitAbilityConfig(meta)
    this.pushScript([
      buildUnitAbilityDiceRollGroup(phase, {
        firing,
        hitSource: baseConfig.hitSource,
        allowedUnitTypes: baseConfig.allowedUnitTypes,
        customDice,
        routing,
      }),
      ...this.getAssignHitsScript(phase),
      { kind: 'method', fn: CombatState.prototype._postAssignHits, phase },
    ])
  }

  // ===========================================================================
  // COMBAT PHASE PROCESSING (shared by SPACE_COMBAT and GROUND_COMBAT)
  // ===========================================================================
}

/** Build a PhaseStepGroup that fires the DESTROY → WHEN_DESTROY →
 *  AFTER_DESTROY cascade once, sharing the destroyed-units map as the
 *  group's `data`. Steps are stored in reverse execution order so the
 *  group pops DESTROY first. */
export function buildDestroyGroup(
  destroyedContext: {
    attacker: Record<string, import('@/types').UnitId[]>
    defender: Record<string, import('@/types').UnitId[]>
  },
  phase: MetaPhase[],
): PhaseStepGroup {
  return {
    kind: 'group',
    data: destroyedContext,
    steps: [
      { kind: 'timing', timing: 'AFTER_DESTROY', phase },
      { kind: 'timing', timing: 'WHEN_DESTROY', phase },
      { kind: 'timing', timing: 'DESTROY', phase },
    ],
  }
}

/** Clone a pending-steps stack for branching. Groups get a new wrapper
 *  and a new inner `steps` array, and every timing step is shallow-
 *  copied (with `frame.tracker` deep-cloned) so sibling branches don't
 *  share mutable engine state. Method steps are immutable from the
 *  engine's perspective and can be shared by reference. */
export function clonePendingSteps(steps: PendingStep[]): PendingStep[] {
  return steps.map(s =>
    s.kind === 'group' ? { ...s, steps: s.steps.map(cloneStep) } : cloneStep(s),
  )
}

function cloneStep(step: PhaseStep): PhaseStep {
  if (step.kind !== 'timing') return step
  const cloned = { ...step }
  if (cloned.frame) {
    cloned.frame = {
      ...cloned.frame,
      tracker: cloneTracker(cloned.frame.tracker),
    }
  }
  return cloned
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

/** Build the four-step group that resolves a combat dice roll:
 *  _collectDice → BEFORE_DICE_ROLL → _rollDice → AFTER_DICE_ROLL.
 *  Stored reversed for the LIFO stack. */
export function buildCombatDiceRollGroup(phase: MetaPhase[]): PhaseStepGroup {
  const data: DiceRollContext = {
    hitSource: 'COMBAT',
    firing: ['attacker', 'defender'],
    isUnitAbility: false,
  }
  return {
    kind: 'group',
    data,
    steps: [
      { kind: 'timing', timing: 'AFTER_DICE_ROLL', phase },
      { kind: 'method', fn: CombatState.prototype._rollDice, phase },
      { kind: 'timing', timing: 'BEFORE_DICE_ROLL', phase },
      { kind: 'method', fn: CombatState.prototype._collectDice, phase },
    ],
  }
}

/** Build the four-step group that resolves a unit-ability dice roll.
 *  Config is derived from `_getUnitAbilityConfig` for phase-script
 *  emissions and merged with overrides from
 *  `runUnitAbilityStepForAbility` (firing restricted to the caller's
 *  side, optional `customDice`, optional `routing`). */
export function buildUnitAbilityDiceRollGroup(
  phase: MetaPhase[],
  config: {
    firing: CombatSide[]
    hitSource: HitSource
    allowedUnitTypes?: ReadonlySet<UnitBaseType>
    customDice?: SidedDiceData
    routing?: { attacker: CombatSide; defender: CombatSide }
  },
): PhaseStepGroup {
  const data: DiceRollContext = {
    hitSource: config.hitSource,
    firing: config.firing,
    allowedUnitTypes: config.allowedUnitTypes,
    customDice: config.customDice,
    routing: config.routing,
    isUnitAbility: true,
  }
  return {
    kind: 'group',
    data,
    steps: [
      {
        kind: 'timing',
        timing: 'AFTER_UNIT_ABILITY_ROLL',
        phase,
        options: buildUnitAbilityRunOptions(config.firing, config.routing, {
          firingOnly: true,
          timing: 'after',
        }),
      },
      { kind: 'method', fn: CombatState.prototype._rollDice, phase },
      {
        kind: 'timing',
        timing: 'BEFORE_UNIT_ABILITY_ROLL',
        phase,
        options: buildUnitAbilityRunOptions(config.firing, config.routing, {
          timing: 'before',
        }),
      },
      { kind: 'method', fn: CombatState.prototype._collectDice, phase },
    ],
  }
}

/** Apply stored hit-value modifiers to a dice pool for one side */
function applyStoredHitValueModifiers(
  pool: DicePool,
  modifiers: readonly HitValueModifier[],
): void {
  for (const mod of modifiers) {
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
 *  `units: UnitId[]` and `unitType: Record<UnitId, UnitType>` stay shared
 *  with base; every mutation path (assignHits, removeUnits, placeUnits,
 *  addSubtype, removeSubtype) writes fresh arrays/records. unitState is
 *  deep-cloned because SUSTAIN_DAMAGE mutates entries (`isDamaged`).
 *  `abilities` (initial config) is shared by reference; `liveAbilities`
 *  is shallow-copied so per-entry COW mutations stay branch-local. */
export function cloneStateForBranch(base: CombatStateData): CombatStateData {
  return {
    ...base,
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
      hits: [defenderHits, 0],
      validTargets: validTargets[defenderHitsTarget],
    })
  }
  if (attackerHits > 0) {
    data[attackerHitsTarget].hitPools.push({
      hits: [attackerHits, 0],
      validTargets: validTargets[attackerHitsTarget],
    })
  }
}

/** Check if a side has any alive units (participating or not). */
function hasAnyUnits(side: SideStateData): boolean {
  return (
    side.participatingUnits.length > 0 || side.nonParticipatingUnits.length > 0
  )
}

/** Pick the sacrifice-priority list for `side` during `meta`:
 *  - SCO → `scoUnitPriority` (may be reordered by e.g. Graviton)
 *  - GROUND metas → `groundUnitPriority`
 *  - SPACE / AFB / BOMBARDMENT / SCD → `spaceUnitPriority` (they all
 *    target ships or use the same space priority ordering). */
function getPhasePriorityList(
  data: CombatStateData,
  side: CombatSide,
  meta: MetaPhase,
): UnitType[] | undefined {
  const baseSide = data[side].abilities
  const liveSide = data[side].liveAbilities
  const baseUP = baseSide['UNIT_PRIORITY']
  const liveUP = liveSide['UNIT_PRIORITY']
  if (baseUP === undefined && liveUP === undefined) return undefined
  const unitPriority =
    liveUP === undefined
      ? baseUP
      : baseUP === undefined
        ? liveUP
        : { ...baseUP, ...liveUP }
  if (!unitPriority) return undefined
  const key =
    meta === 'SPACE_CANNON_OFFENSE'
      ? 'scoUnitPriority'
      : data.combatMode === 'GROUND'
        ? 'groundUnitPriority'
        : 'spaceUnitPriority'
  return unitPriority[key] as UnitType[] | undefined
}

const liveAbilitiesSideHashCache = new WeakMap<SideAbilitiesConfig, string>()

/** Hash one side's `liveAbilities` — the initial `abilities` config is fixed
 *  for the whole combat, so it never differentiates states. Only runtime
 *  mutations (isEnabled, uses, ability-specific fields) matter for state
 *  identity. */
function getSideLiveAbilitiesHash(side: SideAbilitiesConfig): string {
  const cached = liveAbilitiesSideHashCache.get(side)
  if (cached !== undefined) return cached
  const keys = Object.keys(side).sort()
  const result =
    keys.length === 0
      ? ''
      : keys.map(k => `${k}:${JSON.stringify(side[k])}`).join(',')
  liveAbilitiesSideHashCache.set(side, result)
  return result
}

function getSideHash(side: SideStateData): string {
  return (
    side.participatingUnits.join(',') +
    '!' +
    side.nonParticipatingUnits.join(',') +
    '|' +
    JSON.stringify(side.unitState)
  )
}
