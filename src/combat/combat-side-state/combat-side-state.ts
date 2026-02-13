import { UNIT_TYPES } from '@/constants/units'
import type {
  CombatSide,
  FactionKey,
  SourcedDiceGroup,
  Unit,
  UnitAbility,
  UnitSelection,
  UnitType,
} from '@/types'
import {
  buildUnitStatsMap,
  getSimulationUnits,
} from '@/utils/get-simulation-units'

import type { DicePool } from '../abilities/types'
import type { CombatState } from '../combat-state/combat-state'
import type { HitSource, SideStateData } from '../combat-state/types'
import { parseVariantId, unitMatchesVariant } from '../utils/unit-variant'

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

function destroyUnitsFromPool(
  units: Partial<Record<UnitType, Unit[]>>,
  hits: number,
  validTargets: UnitType[],
  sacrificeOrder: string[],
): Partial<Record<UnitType, Unit[]>> {
  if (hits <= 0) return units

  const targetSet = validTargets.length > 0 ? new Set(validTargets) : null
  const destroyIndices = new Map<UnitType, Set<number>>()
  let remaining = hits

  for (const variantId of sacrificeOrder) {
    if (remaining <= 0) break
    const { type } = parseVariantId(variantId)
    if (targetSet && !targetSet.has(type)) continue
    const typeUnits = units[type]
    if (!typeUnits) continue

    const alreadyMarked = destroyIndices.get(type) ?? new Set<number>()
    for (let i = 0; i < typeUnits.length && remaining > 0; i++) {
      if (alreadyMarked.has(i)) continue
      if (unitMatchesVariant(typeUnits[i], variantId)) {
        alreadyMarked.add(i)
        remaining--
      }
    }
    destroyIndices.set(type, alreadyMarked)
  }

  // Build new units object, removing destroyed units
  const newUnits: Partial<Record<UnitType, Unit[]>> = {}

  for (const [type, typeUnits] of Object.entries(units)) {
    const unitType = type as UnitType
    const indices = destroyIndices.get(unitType)
    const kept = indices
      ? typeUnits!.filter((_, i) => !indices.has(i))
      : typeUnits!

    if (kept.length > 0) {
      newUnits[unitType] = kept
    }
  }

  return newUnits
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

    const skipParticipatingFilter =
      source === 'SPACE_CANNON' || source === 'BOMBARDMENT'

    for (const [type, units] of Object.entries(this.data.units)) {
      if (!units || units.length === 0) continue
      if (allowedUnitTypes && !allowedUnitTypes.has(type as UnitType)) continue
      if (!skipParticipatingFilter && !participatingUnits.has(type as UnitType))
        continue

      const unitType = type as UnitType

      // Check restrictions for unit ability sources
      if (source !== 'COMBAT') {
        if (
          this.isUnitAbilityLost(source, unitType) ||
          this.isUnitAbilityCannotBeUsed(source, unitType)
        ) {
          continue
        }
      }

      const dice: SourcedDiceGroup[] = []
      for (let i = 0; i < units.length; i++) {
        const unit = units[i]
        const dieData =
          source === 'COMBAT' ? unit.COMBAT : unit.UNIT_ABILITIES?.[source]
        if (!dieData) continue

        const [hitValue, dicePerUnit] = dieData
        if (dicePerUnit <= 0) continue
        dice.push([hitValue, dicePerUnit, unit])
      }
      if (dice.length === 0) continue

      result[unitType] = dice
    }

    return result
  }

  countUnits(participatingUnits?: ReadonlySet<UnitType>): number {
    let total = 0
    for (const [type, units] of Object.entries(this.data.units)) {
      if (!units) continue
      if (participatingUnits && !participatingUnits.has(type as UnitType))
        continue
      total += units.length
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

    let currentUnits = { ...this.data.units }

    for (const pool of this.data.hitPools) {
      currentUnits = destroyUnitsFromPool(
        currentUnits,
        pool.hits,
        pool.validTargets,
        sacrificeOrder,
      )
    }

    this.updateSideData({ units: currentUnits, hitPools: [] })
  }

  // ── UI mutation methods ───────────────────────────────────────────

  setFaction(faction: FactionKey): void {
    const units = getSimulationUnits(faction, this.unitSelections)
    const upgrades = new Set(
      UNIT_TYPES.filter(t => this.unitSelections[t].upgraded),
    )
    const unitStats = buildUnitStatsMap(faction, upgrades)
    this.updateSideData({ faction, units, unitStats })
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
    const units = getSimulationUnits(this.data.faction, selections)
    const upgrades = new Set(UNIT_TYPES.filter(t => selections[t].upgraded))
    const unitStats = buildUnitStatsMap(this.data.faction, upgrades)
    this.updateSideData({ units, unitSelections: selections, unitStats })
  }

  setUnitCount(unitType: UnitType, count: number): void {
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
