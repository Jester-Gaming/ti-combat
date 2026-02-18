import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
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
  units: Partial<Record<UnitType, Unit[]>>,
  hits: number,
  validTargets: UnitType[],
  sacrificeOrder: string[],
): Partial<Record<UnitType, Unit[]>> {
  if (hits <= 0) return units

  // Fast path: when all sacrifice variants are plain types (no subtypes)
  // and all targeted units are plain (no subtypes), use count-based slice
  const fast = tryFastDestroy(units, hits, validTargets, sacrificeOrder)
  if (fast !== null) return fast

  // Slow path: full variant matching with boolean marks
  const destroyed = new Map<UnitType, boolean[]>()
  let remaining = hits

  for (const variantId of sacrificeOrder) {
    if (remaining <= 0) break
    const { type, subtypes } = parseVariantId(variantId)
    if (validTargets.length > 0 && !validTargets.includes(type)) continue
    const typeUnits = units[type]
    if (!typeUnits) continue

    let marks = destroyed.get(type)
    if (!marks) {
      marks = new Array<boolean>(typeUnits.length).fill(false)
      destroyed.set(type, marks)
    }

    const hasSubtypes = subtypes.length > 0
    for (let i = 0; i < typeUnits.length && remaining > 0; i++) {
      if (marks[i]) continue
      const unit = typeUnits[i]
      // Inline variant matching to avoid extra function call
      if (!hasSubtypes) {
        if (unit.subtypes && unit.subtypes.length > 0) continue
      } else {
        if (!unit.subtypes || unit.subtypes.length !== subtypes.length) continue
        if (!subtypes.every(s => unit.subtypes!.includes(s))) continue
      }
      marks[i] = true
      remaining--
    }
  }

  if (remaining === hits) return units // nothing destroyed

  const newUnits: Partial<Record<UnitType, Unit[]>> = {}
  for (const type in units) {
    const unitType = type as UnitType
    const typeUnits = units[unitType]!
    const marks = destroyed.get(unitType)
    if (!marks) {
      newUnits[unitType] = typeUnits
      continue
    }
    const kept = typeUnits.filter((_, i) => !marks[i])
    if (kept.length > 0) {
      newUnits[unitType] = kept
    }
  }

  return newUnits
}

/** Fast path for plain units (no subtypes): count-based destruction with slice */
function tryFastDestroy(
  units: Partial<Record<UnitType, Unit[]>>,
  hits: number,
  validTargets: UnitType[],
  sacrificeOrder: string[],
): Partial<Record<UnitType, Unit[]>> | null {
  // Bail if any sacrifice variant has subtypes
  for (const variantId of sacrificeOrder) {
    const { subtypes } = parseVariantId(variantId)
    if (subtypes.length > 0) return null
  }

  // Bail if any targeted unit type has units with subtypes
  for (const variantId of sacrificeOrder) {
    const { type } = parseVariantId(variantId)
    const typeUnits = units[type]
    if (!typeUnits) continue
    for (const u of typeUnits) {
      if (u.subtypes && u.subtypes.length > 0) return null
    }
  }

  // All plain: use count-based destruction
  let remaining = hits
  // Track how many to destroy per type
  const destroyCounts = new Map<UnitType, number>()

  for (const variantId of sacrificeOrder) {
    if (remaining <= 0) break
    const { type } = parseVariantId(variantId)
    if (validTargets.length > 0 && !validTargets.includes(type)) continue
    const typeUnits = units[type]
    if (!typeUnits) continue

    const alreadyDestroyed = destroyCounts.get(type) ?? 0
    const available = typeUnits.length - alreadyDestroyed
    if (available <= 0) continue

    const toDestroy = Math.min(available, remaining)
    destroyCounts.set(type, alreadyDestroyed + toDestroy)
    remaining -= toDestroy
  }

  if (destroyCounts.size === 0) return units // nothing destroyed

  const newUnits: Partial<Record<UnitType, Unit[]>> = {}
  for (const type in units) {
    const unitType = type as UnitType
    const typeUnits = units[unitType]!
    const destroyCount = destroyCounts.get(unitType)
    if (!destroyCount) {
      newUnits[unitType] = typeUnits
      continue
    }
    const keepCount = typeUnits.length - destroyCount
    if (keepCount > 0) {
      newUnits[unitType] = typeUnits.slice(0, keepCount)
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

    let currentUnits = this.data.units

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
