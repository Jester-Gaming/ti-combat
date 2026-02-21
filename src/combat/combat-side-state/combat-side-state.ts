import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import type {
  CombatSide,
  FactionKey,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitSelection,
} from '@/types'
import { getSimulationUnits } from '@/utils/get-simulation-units'

import type { DicePool } from '../abilities/types'
import type { CombatState } from '../combat-state/combat-state'
import type {
  CombatStateData,
  HitSource,
  SideStateData,
} from '../combat-state/types'
import { resolveUnitStats } from '../utils/compact-units'
import { parseVariantId } from '../utils/unit-variant'
import { getSettingsValidTargets } from './utils/get-settings-valid-targets'

export function createDefaultUnitSelections(): Record<
  UnitBaseType,
  UnitSelection
> {
  return UNIT_TYPES.reduce(
    (acc, unitType) => {
      acc[unitType] = { count: 0, upgraded: false }
      return acc
    },
    {} as Record<UnitBaseType, UnitSelection>,
  )
}

/** Get the opposite side */
export function getOpponentSide(side: CombatSide): CombatSide {
  return side === 'attacker' ? 'defender' : 'attacker'
}

// Cache for getParticipatingUnits: source array → Set
const participatingUnitsCache = new WeakMap<
  UnitBaseType[],
  ReadonlySet<UnitBaseType>
>()

export function getParticipatingUnitsSet(
  units: UnitBaseType[],
): ReadonlySet<UnitBaseType> {
  let cached = participatingUnitsCache.get(units)
  if (!cached) {
    cached = new Set(units)
    participatingUnitsCache.set(units, cached)
  }
  return cached
}

/** Shared empty destroyed record to avoid per-call {} allocation */
const EMPTY_DESTROYED: Record<string, UnitId[]> = {}

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

function isRestricted(
  sideState: SideStateData,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  unitType: UnitBaseType,
): boolean {
  const entries = sideState.unitAbilityRestrictions?.[layer]?.[ability]
  if (!entries) return false

  return entries.some(e => !e.unitType || e.unitType === unitType)
}

export class CombatSideState {
  private _combatState: CombatState
  private _side: CombatSide

  constructor(combatState: CombatState, side: CombatSide) {
    this._combatState = combatState
    this._side = side
  }

  private get data(): SideStateData {
    return this._combatState.data[this._side]
  }

  /** Immutably update this side's state data */
  private updateSideData(updates: Partial<SideStateData>): void {
    this._combatState.data = {
      ...this._combatState.data,
      [this._side]: { ...this.data, ...updates },
    }
  }

  get faction(): FactionKey {
    return this.data.faction
  }

  get units() {
    return this.data.units
  }

  get hitPools() {
    return this.data.hitPools
  }

  get unitAbilityRestrictions() {
    return this.data.unitAbilityRestrictions
  }

  get unitSelections(): Record<UnitBaseType, UnitSelection> {
    return this.data.unitSelections ?? createDefaultUnitSelections()
  }

  get side(): CombatSide {
    return this._side
  }

  /** Get participating units from SETTINGS ability */
  getParticipatingUnits(): ReadonlySet<UnitBaseType> {
    const settings = this._combatState.data.abilities[this._side]['SETTINGS']

    if (!settings) {
      throw new Error('No SETTINGS in getParticipatingUnits')
    }

    const units =
      this._combatState.data.combatMode === 'GROUND'
        ? (settings.groundCombatParticipating as UnitBaseType[])
        : (settings.spaceCombatParticipating as UnitBaseType[])

    return getParticipatingUnitsSet(units)
  }

  /** Get valid targets for the current phase from SETTINGS ability */
  getValidTargetsForPhase(
    stateData: CombatStateData = this._combatState.data,
  ): UnitBaseType[] {
    const settings = stateData.abilities[this._side]['SETTINGS']

    if (!settings) {
      throw new Error('No SETTINGS in getValidTargetsForPhase')
    }

    return getSettingsValidTargets(
      settings,
      this._combatState.currentPhase.meta,
    )
  }

  collectDice(
    source: HitSource,
    allowedUnitTypes?: ReadonlySet<UnitBaseType>,
  ): DicePool {
    const participatingUnits = this.getParticipatingUnits()
    const result: DicePool = {}
    const data = this.data
    const { units } = data

    const skipParticipatingFilter =
      source === 'SPACE_CANNON' || source === 'BOMBARDMENT'

    // Track which base types had restrictions checked
    const restrictionChecked = new Map<UnitBaseType, boolean>()

    for (const key of Object.keys(units)) {
      const ids = units[key]
      if (ids.length <= 0) continue

      const { type } = parseVariantId(key)
      if (allowedUnitTypes && !allowedUnitTypes.has(type)) continue
      if (!skipParticipatingFilter && !participatingUnits.has(type)) continue

      // Check restrictions once per base type
      if (source !== 'COMBAT') {
        let allowed = restrictionChecked.get(type)
        if (allowed === undefined) {
          allowed = !(
            this.isUnitAbilityLost(source, type) ||
            this.isUnitAbilityCannotBeUsed(source, type)
          )
          restrictionChecked.set(type, allowed)
        }
        if (!allowed) continue
      }

      // Read dice values directly from shared stats
      const stats = resolveUnitStats(data, key)
      if (!stats) continue
      const dieData =
        source === 'COMBAT' ? stats.COMBAT : stats.UNIT_ABILITIES?.[source]
      if (!dieData) continue
      const [hitValue, dicePerUnit] = dieData
      if (dicePerUnit <= 0) continue

      // Store UnitId directly per unit
      const arr = result[type] ?? []
      for (const id of ids) {
        arr.push([hitValue, dicePerUnit, id])
      }
      result[type] = arr
    }

    return result
  }

  /** Get participating units from a (potentially modified) state data snapshot */
  private getParticipatingUnitsFromData(
    stateData: CombatStateData,
  ): ReadonlySet<UnitBaseType> {
    const settings = stateData.abilities[this._side]['SETTINGS']
    if (!settings)
      throw new Error('No SETTINGS in getParticipatingUnitsFromData')

    const units =
      stateData.combatMode === 'GROUND'
        ? (settings.groundCombatParticipating as UnitBaseType[])
        : (settings.spaceCombatParticipating as UnitBaseType[])

    return getParticipatingUnitsSet(units)
  }

  /** Get unit priority from a (potentially modified) state data snapshot */
  private getUnitPriorityFromData(stateData: CombatStateData): string[] {
    const unitPriority = stateData.abilities[this._side]['UNIT_PRIORITY']
    if (!unitPriority)
      throw new Error('No UNIT_PRIORITY in getUnitPriorityFromData')

    const key =
      stateData.combatMode === 'GROUND'
        ? 'groundUnitPriority'
        : 'spaceUnitPriority'
    return unitPriority[key] as string[]
  }

  /** Assign hits to this side, returning new SideStateData and destroyed UnitIds.
   * Batches all hit pools into a single pass to minimize object spreads.
   * When trackDestroyed is false, skips building the destroyed record. */
  assignHits(
    stateData: CombatStateData,
    trackDestroyed?: boolean,
  ): { state: SideStateData; destroyed: Record<string, UnitId[]> } {
    const sideData = stateData[this._side]
    if (sideData.hitPools.length === 0)
      return { state: sideData, destroyed: EMPTY_DESTROYED }

    const participatingUnits = this.getParticipatingUnitsFromData(stateData)
    const unitPriority = this.getUnitPriorityFromData(stateData)
    const sacrificeOrder = getFilteredSacrificeOrder(
      unitPriority,
      participatingUnits,
    )

    // Spread once, then mutate in-place across all pools
    const newUnits = { ...sideData.units }
    let destroyed: Record<string, UnitId[]> | undefined
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

        const origIds = newUnits[variantId]
        if (!origIds || origIds.length <= 0) continue

        const toDestroy = Math.min(origIds.length, remaining)
        changed = true

        // Clone the array before mutating (newUnits is shallow-spread, arrays are shared)
        const ids = origIds.slice(0, origIds.length - toDestroy)

        // Track destroyed UnitIds (only when destroy abilities or logging need it)
        if (trackDestroyed) {
          if (!destroyed) destroyed = {}
          if (!destroyed[variantId]) destroyed[variantId] = []
          for (let i = origIds.length - toDestroy; i < origIds.length; i++) {
            destroyed[variantId].push(origIds[i])
          }
        }

        if (ids.length <= 0) {
          delete newUnits[variantId]
        } else {
          newUnits[variantId] = ids
        }

        remaining -= toDestroy
      }
    }

    // Always clear hitPools — even when no units were destroyed,
    // stale pools must not leak into subsequent phases
    if (!changed)
      return {
        state: { ...sideData, hitPools: [] },
        destroyed: EMPTY_DESTROYED,
      }

    return {
      state: {
        ...sideData,
        units: newUnits,
        hitPools: [],
      },
      destroyed: destroyed ?? EMPTY_DESTROYED,
    }
  }

  countUnits(filter?: UnitBaseType | UnitBaseType[]): number {
    let total = 0
    const filterSet = filter
      ? typeof filter === 'string'
        ? new Set([filter])
        : new Set(filter)
      : undefined
    for (const [key, ids] of Object.entries(this.data.units)) {
      if (ids.length <= 0) continue
      if (filterSet) {
        const { type } = parseVariantId(key)
        if (!filterSet.has(type)) continue
      }
      total += ids.length
    }
    return total
  }

  isUnitAbilityLost(ability: UnitAbility, unitType: UnitBaseType): boolean {
    return isRestricted(this.data, 'lost', ability, unitType)
  }

  isUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    unitType: UnitBaseType,
  ): boolean {
    return isRestricted(this.data, 'cannotBeUsed', ability, unitType)
  }

  isUpgraded(unitType: UnitBaseType): boolean {
    return this.unitSelections[unitType].upgraded
  }

  // ── UI mutation methods ───────────────────────────────────────────

  setFaction(faction: FactionKey): void {
    const { units, unitState, unitStats } = getSimulationUnits(
      faction,
      this.unitSelections,
    )
    this.updateSideData({ faction, units, unitState, unitStats })
    this._combatState.params.reconcileFaction(this._side, faction)
  }

  private updateSelection(
    unitType: UnitBaseType,
    update: Partial<UnitSelection>,
  ): void {
    const selections = {
      ...this.unitSelections,
      [unitType]: { ...this.unitSelections[unitType], ...update },
    }
    const { units, unitState, unitStats } = getSimulationUnits(
      this.data.faction,
      selections,
    )
    this.updateSideData({
      units,
      unitState,
      unitStats,
      unitSelections: selections,
    })
  }

  setUnitCount(unitType: UnitBaseType, count: number): void {
    const limit = UNIT_LIMITS[unitType]
    if (count > limit) {
      console.warn(`Unit limit exceeded: ${unitType} has a maximum of ${limit}`)
      count = limit
    }
    this.updateSelection(unitType, { count })
  }

  setUpgraded(unitType: UnitBaseType, upgraded: boolean): void {
    this.updateSelection(unitType, { upgraded })
  }

  setAbilityParam(abilityKey: string, params: Record<string, unknown>): void {
    this._combatState.params.setParam(this._side, abilityKey, params)
    // Force new cs.data reference so React memoization triggers
    this._combatState.data = { ...this._combatState.data }
  }
}
