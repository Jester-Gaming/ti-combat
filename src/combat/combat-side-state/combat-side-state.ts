import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import type {
  CombatSide,
  FactionKey,
  UnitAbility,
  UnitSelection,
  UnitType,
} from '@/types'
import { getSimulationUnits } from '@/utils/get-simulation-units'

import type { DicePool } from '../abilities/types'
import type { CombatState } from '../combat-state/combat-state'
import type { HitSource, SideStateData } from '../combat-state/types'
import { resolveUnitStats } from '../utils/compact-units'
import { parseVariantId } from '../utils/unit-variant'

export function createDefaultUnitSelections(): Record<UnitType, UnitSelection> {
  return UNIT_TYPES.reduce(
    (acc, unitType) => {
      acc[unitType] = { count: 0, upgraded: false }
      return acc
    },
    {} as Record<UnitType, UnitSelection>,
  )
}

/** Get the opposite side */
export function getOpponentSide(side: CombatSide): CombatSide {
  return side === 'attacker' ? 'defender' : 'attacker'
}

export function destroyUnitsFromPool(
  sideState: SideStateData,
  hits: number,
  validTargets: UnitType[],
  sacrificeOrder: string[],
): SideStateData {
  if (hits <= 0) return sideState

  let remaining = hits
  let changed = false
  const newUnits = { ...sideState.units }
  const newUnitState = { ...sideState.unitState }

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
      // Truncate unitState from end if needed
      const stateArr = newUnitState[variantId]
      if (stateArr && stateArr.length > newCount) {
        newUnitState[variantId] = stateArr.slice(0, newCount)
      }
    }

    remaining -= toDestroy
  }

  if (!changed) return sideState

  return { ...sideState, units: newUnits, unitState: newUnitState }
}

function isRestricted(
  sideState: SideStateData,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  unitType: UnitType,
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

  get unitSelections(): Record<UnitType, UnitSelection> {
    return this.data.unitSelections ?? createDefaultUnitSelections()
  }

  get side(): CombatSide {
    return this._side
  }

  collectDice(
    source: HitSource,
    participatingUnits: ReadonlySet<UnitType>,
    allowedUnitTypes?: ReadonlySet<UnitType>,
  ): DicePool {
    const result: DicePool = {}
    const data = this.data
    const { units } = data

    const skipParticipatingFilter =
      source === 'SPACE_CANNON' || source === 'BOMBARDMENT'

    // Track which base types had restrictions checked
    const restrictionChecked = new Map<UnitType, boolean>()

    for (const key of Object.keys(units)) {
      const count = units[key]
      if (count <= 0) continue

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

      // Store UnitLocator directly per unit
      const arr = result[type] ?? []
      for (let i = 0; i < count; i++) {
        arr.push([hitValue, dicePerUnit, { key, index: i }])
      }
      result[type] = arr
    }

    return result
  }

  countUnits(participatingUnits?: ReadonlySet<UnitType>): number {
    let total = 0
    for (const [key, count] of Object.entries(this.data.units)) {
      if (count <= 0) continue
      if (participatingUnits) {
        const { type } = parseVariantId(key)
        if (!participatingUnits.has(type)) continue
      }
      total += count
    }
    return total
  }

  isUnitAbilityLost(ability: UnitAbility, unitType: UnitType): boolean {
    return isRestricted(this.data, 'lost', ability, unitType)
  }

  isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: UnitType): boolean {
    return isRestricted(this.data, 'cannotBeUsed', ability, unitType)
  }

  isUpgraded(unitType: UnitType): boolean {
    return this.unitSelections[unitType].upgraded
  }

  addHits(hits: number, validTargets: UnitType[]): void {
    if (hits === 0) return
    this.updateSideData({
      hitPools: [...this.data.hitPools, { hits, validTargets }],
    })
  }

  assignHits(
    participatingUnits: ReadonlySet<UnitType>,
    unitPriority: string[],
  ): void {
    if (this.data.hitPools.length === 0) return

    const sacrificeOrder = unitPriority.filter(id => {
      const { type } = parseVariantId(id)
      return participatingUnits.has(type)
    })

    let currentSideState = this.data

    for (const pool of this.data.hitPools) {
      currentSideState = destroyUnitsFromPool(
        currentSideState,
        pool.hits,
        pool.validTargets,
        sacrificeOrder,
      )
    }

    this.updateSideData({
      units: currentSideState.units,
      unitState: currentSideState.unitState,
      hitPools: [],
    })
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
    unitType: UnitType,
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

  setUnitCount(unitType: UnitType, count: number): void {
    const limit = UNIT_LIMITS[unitType]
    if (count > limit) {
      console.warn(`Unit limit exceeded: ${unitType} has a maximum of ${limit}`)
      count = limit
    }
    this.updateSelection(unitType, { count })
  }

  setUpgraded(unitType: UnitType, upgraded: boolean): void {
    this.updateSelection(unitType, { upgraded })
  }

  setAbilityParam(abilityKey: string, params: Record<string, unknown>): void {
    this._combatState.params.setParam(this._side, abilityKey, params)
    // Force new cs.data reference so React memoization triggers
    this._combatState.data = { ...this._combatState.data }
  }
}
