import type { UnitCategory } from '@/constants/units'
import type {
  CombatSide,
  FactionKey,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitList,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'

import type {
  AbilityPassFrame,
  AbilityTiming,
  RunAbilitiesOptions,
  SidedDiceData,
} from '../abilities-engine'
// `PhaseStep` references `CombatState` in its method `fn` signature; the
// import is type-only to avoid a runtime cycle.
import type { CombatState, StateWithProbability } from './combat-state'

/**
 * Combat mode determines which meta-phase flow to use.
 * - SPACE: Space combat between ships (Space Cannon Offense -> Space Combat)
 * - GROUND: Ground combat on planets (Bombardment -> Space Cannon Defense -> Ground Combat)
 */
export type CombatMode = 'SPACE' | 'GROUND'

/** Subset of MetaPhase that can be used with AbilityCallContext.resolveStep. */
export type UnitAbilityMeta =
  | 'BOMBARDMENT'
  | 'AFB'
  | 'SPACE_CANNON_OFFENSE'
  | 'SPACE_CANNON_DEFENSE'

/**
 * MetaPhase represents the major combat stages in TI4.
 *
 * Space Combat flow:
 * - SPACE_CANNON_OFFENSE: PDS fire at ships before combat begins
 * - AFB: Anti-Fighter Barrage (occurs during round 1 of space combat)
 * - SPACE_COMBAT: Standard space combat rounds
 *
 * Ground Combat flow:
 * - BOMBARDMENT: Ships with bombardment fire at ground forces
 * - SPACE_CANNON_DEFENSE: Defender's PDS fire at invading ground forces
 * - GROUND_COMBAT: Standard ground combat rounds
 *
 * Completion is tracked out-of-band via `CombatStateData.isFinished`, not a
 * dedicated meta. Phase-flow helpers (`getNextPhaseInFlow`) and transition
 * targets use `MetaPhase | 'COMPLETE'`; 'COMPLETE' is a completion signal,
 * never a real script-driven meta.
 */

export type MetaPhase =
  | 'SPACE_COMBAT'
  | 'COMMIT_UNITS'
  | 'GROUND_COMBAT'
  | UnitAbilityMeta

/** Where a transition can point: any real meta, or the `'COMPLETE'` sentinel
 *  that signals "run the end-of-combat cleanup and mark combat finished." */
export type PhaseTransitionTarget = MetaPhase | 'COMPLETE'

/** Meta-phases that correspond to unit ability rolls (bombardment, space cannon, AFB). */
export const UNIT_ABILITY_PHASES: MetaPhase[] = [
  'SPACE_CANNON_OFFENSE',
  'AFB',
  'BOMBARDMENT',
  'SPACE_CANNON_DEFENSE',
]

/**
 * PhaseMarker names a transient sub-step within a meta-phase. Only used by
 * the engine and test harness to navigate within a script; not part of the
 * authoritative combat state data.
 */
export type PhaseMarker = 'START' | 'DICE_ROLL' | 'ASSIGN_HITS' | 'END'

/** A pool of unassigned hits with valid targets.
 *  hits[0] = base (from dice rolls), hits[1] = bonus (from abilities).
 *  Abilities that double hits (e.g. X-89) only double base hits. */
export interface HitPool {
  hits: [number, number]
  validTargets?: UnitType[]
}

/** A single restriction entry explaining why an ability is restricted */
export interface RestrictionEntry {
  reason: string
  unitType?: UnitBaseType
  category?: UnitCategory
}

/** Two-layer restriction system for unit abilities */
export interface UnitAbilityRestrictions {
  cannotBeUsed?: Partial<Record<UnitAbility, RestrictionEntry[]>>
  lost?: Partial<Record<UnitAbility, RestrictionEntry[]>>
}

/** Resolved form of `UnitAbilityRestrictions`, derived from the raw
 *  entries + current unit composition + live SETTINGS. Stored per layer
 *  per ability: either `'ALL'` (blanket restriction, applies to every
 *  unit type) or a `Set` of restricted variant keys / base types.
 *  Lookup is O(1) — built lazily on first read after any mutation
 *  that could affect restriction outcomes. */
export type ResolvedRestrictionsLayer = Map<UnitAbility, Set<UnitType> | 'ALL'>
export interface ResolvedRestrictions {
  cannotBeUsed: ResolvedRestrictionsLayer
  lost: ResolvedRestrictionsLayer
}

/** A stored hit-value modifier applied after BEFORE_DICE_ROLL abilities.
 *  Scoped to a dice-roll group via `DiceRollContext.hitValueModifiers`, so
 *  it's naturally discarded once the group processes. */
export interface HitValueModifier {
  amount: number
  unitType?: string
  excludeUnitTypes?: string[]
  unitId?: UnitId
}

/** A stats entry: either concrete stats or a factory that derives from parent type stats */
export type UnitStatsEntry = UnitStats | ((parentStats: UnitStats) => UnitStats)

/** Ability configuration for one side (key → params). */
export type SideAbilitiesConfig = Record<string, Record<string, unknown>>

/** State data for one side of combat */
export interface SideStateData {
  faction: FactionKey
  /** Participating UnitIds packed into a `UnitList` (one UTF-16 char
   *  per UnitId), pre-sorted by combat-mode priority. Highest priority
   *  first, lowest last. `slice(0, -N)` keeps the N highest-priority
   *  units (the lowest-priority ones die first under tail-slice
   *  assign-hits). Stored as a packed string so it can be concatenated
   *  directly into the state-identity hash without conversion. */
  participatingUnits: UnitList
  /** Non-participating UnitIds packed into a `UnitList` (one UTF-16
   *  char per UnitId), for the current combat mode (e.g. ships during
   *  ground combat). They can still fire unit abilities (bombardment,
   *  SCO/SCD) but are never targeted by normal combat hits. Unsorted. */
  nonParticipatingUnits: UnitList
  /** UnitId → variant key. Populated at setup. Stale entries for
   *  destroyed units are NEVER cleaned — do not use as an "alive" set.
   *  Typed as `Record<string, UnitType>` so callers iterating a packed
   *  UnitId string can index without re-branding each char. */
  unitType: Record<string, UnitType>
  /** UnitId → per-unit mutable state (flat map, sparse — only entries with non-default state) */
  unitState: Record<string, UnitState>
  /** Variant key → shared stats template (may be a factory for subtypes) */
  unitStats: Record<UnitType, UnitStatsEntry>
  hitPools: HitPool[]
  unitAbilityRestrictions?: UnitAbilityRestrictions
  /** Initial ability config for this side, set once at combat start.
   *  Immutable during the run — runtime mutations (isEnabled, uses,
   *  ability-specific fields) live in `liveAbilities` as partial overlays. */
  abilities: SideAbilitiesConfig
  /** Partial overlays on top of `abilities`, written via
   *  `updateAbilityConfig` and `decrementUses`. Only contains entries for
   *  abilities whose config changed during the run. Hashed into the state
   *  identity; reads must merge base+live (see `CombatSideState.getLiveParams`). */
  liveAbilities: SideAbilitiesConfig
  /** CoW marker — when true, `unitState` reference is potentially shared
   *  with another SideStateData (from a branch clone); mutations must
   *  clone first via `ensureUnitStateOwned`. */
  _unitStateShared?: boolean
  /** Variant keys whose pool needs `canonicalizeUnitState` re-run.
   *  Set when a per-unit state mutation may change a unit's destroyScore.
   *  Flushed at BEFORE_ASSIGN_HITS and on hash reads, scoped to only
   *  the affected variant pools. Replaces the previous `_needsResort` flag. */
  _needsCanonicalize?: Set<UnitType>
  /** CoW marker — when true, `hitPools` reference is potentially shared
   *  with another SideStateData; mutations must clone first via
   *  `ensureHitPoolsOwned`. */
  _hitPoolsShared?: boolean
  /** Derived O(1) lookup cache for `unitAbilityRestrictions`, rebuilt
   *  lazily on first read after any mutation that could affect
   *  restriction outcomes (entries added/removed, unit composition
   *  change, SETTINGS live-param change, or cross-side restriction
   *  change that affects source-disable cascades). Not serialized;
   *  always derivable from the raw fields. */
  _resolvedRestrictions?: ResolvedRestrictions
}

/** A single step in the phase-handler script. `advance()` pops one step
 *  and runs it. Branching steps propagate the remainder to each branch.
 *
 *  `phase` is the full stack of active meta-phases for this step, ordered
 *  outer→inner. A plain SPACE_COMBAT step has `['SPACE_COMBAT']`; an AFB
 *  step nested inside SPACE_COMBAT round 1 has `['SPACE_COMBAT', 'AFB']`.
 *  Ability invokes with `context` match if any of the step's phases
 *  appears in `context`.
 *
 *  `data` carries the timing-context payload passed to `runAbilities`
 *  (e.g. the destroyed-units map for DESTROY). When a step lives inside
 *  a `PhaseStepGroup`, the step's own `data` wins if set, otherwise the
 *  group's `data` is used. Method steps ignore it. */
export type PhaseStep = { phase: MetaPhase[]; data?: unknown } & (
  | {
      kind: 'timing'
      timing: AbilityTiming
      options?: RunAbilitiesOptions
      /** In-flight pass state — populated by the ability engine when the
       *  pass parks (e.g. after `ctx.trigger`) or branches; consumed on
       *  resume. Cloned per-branch through `clonePendingSteps` so each
       *  branch carries its own resume point. */
      frame?: AbilityPassFrame
    }
  | {
      kind: 'method'
      fn: (
        this: CombatState,
        phase: MetaPhase[],
        payload?: unknown,
      ) => StateWithProbability[] | void
      payload?: unknown
    }
)

/** A bundle of PhaseStep entries that share `data`. When the group
 *  executes, each inner timing step receives the group's `data` as the
 *  `context` arg to `runAbilities` (e.g. the destroyed-units map for
 *  DESTROY / WHEN_DESTROY / AFTER_DESTROY), unless the step carries its
 *  own `data`. The group is popped once its `steps` drains, discarding
 *  the data. */
export interface PhaseStepGroup {
  kind: 'group'
  data: unknown
  steps: PhaseStep[]
}

/** Entry on the pending-steps stack — either a standalone step or a
 *  group of steps sharing a context. */
export type PendingStep = PhaseStep | PhaseStepGroup

/** Group context for a dice-roll group (combat or unit-ability).
 *  Seeded by the group builder with invariant params; `_collectDice`
 *  populates `dicePool` / `validTargets`; BEFORE timing abilities read
 *  the pool via `ctx.api.own.getDicePool()` and mutate it in place;
 *  `_rollDice` reads it back. */
export interface DiceRollContext {
  hitSource: HitSource
  firing: CombatSide[]
  routing?: { attacker: CombatSide; defender: CombatSide }
  customDice?: SidedDiceData
  allowedUnitTypes?: ReadonlySet<UnitBaseType>
  isUnitAbility: boolean
  dicePool?: SidedDiceData
  validTargets?: { attacker: UnitType[]; defender: UnitType[] }
  /** Hit-value modifiers queued for this dice roll, per side. Written by
   *  `modifyHitValue` during START_OF_COMBAT / BEFORE_(UNIT_ABILITY_)?DICE_ROLL
   *  timings and consumed by `_rollDice`. Dropped when the group drains. */
  hitValueModifiers?: {
    attacker?: HitValueModifier[]
    defender?: HitValueModifier[]
  }
}

/** Type guard used by `SideApi.getDicePool` to recognize a dice-roll
 *  group's context on top of `pendingSteps`. */
export function isDiceRollContext(ctx: unknown): ctx is DiceRollContext {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    'isUnitAbility' in ctx &&
    'hitSource' in ctx
  )
}

/** Complete combat state data */
export interface CombatStateData {
  attacker: SideStateData
  defender: SideStateData
  combatMode: CombatMode
  /** The side that won, or 'draw'. Set whenever a side is wiped (via
   *  `_removeOne` or `_postAssignHits`) or via an ability's `transitionTo`.
   *  Guaranteed to be defined whenever `isFinished` is true — combat
   *  cannot complete without it (the completion script is only pushed by
   *  `_triggerCompletion`, which sets this if it isn't already set). */
  winnerSide?: CombatSide | 'draw'
  /** True once combat has completed — set by `_setComplete` after the
   *  END_OF_COMBAT / CLEANUP_ROUND / CLEANUP timings run. Engine/test
   *  harness check this instead of reading the (now-removed) `currentPhase`. */
  isFinished?: boolean
}

/** Hit source determines dice collection */
export type HitSource = 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON'
