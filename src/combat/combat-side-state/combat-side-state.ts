import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import type {
  CombatSide,
  FactionKey,
  UnitAbility,
  UnitBaseType,
  UnitSelection,
} from '@/types'
import { getSimulationUnits } from '@/utils/get-simulation-units'

import type { DicePool } from '../abilities/types'
import type { CombatState } from '../combat-state/combat-state'
import type { HitSource, SideStateData } from '../combat-state/types'
import { resolveUnitStats } from '../utils/compact-units'
import { parseVariantId } from '../utils/unit-variant'

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

  collectDice(
    source: HitSource,
    participatingUnits: ReadonlySet<UnitBaseType>,
    allowedUnitTypes?: ReadonlySet<UnitBaseType>,
  ): DicePool {
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
