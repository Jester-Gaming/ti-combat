import type { DiceData, UnitAbilityKey, UnitType } from '@/types'

import type { DicePool } from '../abilities/types'
import type { DestroyedUnit } from '../abilities/types'
import type {
  CombatSide,
  CombatStateData,
  HitPool,
  HitSource,
  RestrictionEntry,
  SideState,
  Unit,
  UnitAbilityRestrictions,
  UnitState,
} from './types'

const DEFAULT_UNIT_SACRIFICE_ORDER: UnitType[] = [
  'FIGHTER',
  'INFANTRY',
  'DESTROYER',
  'CRUISER',
  'CARRIER',
  'DREADNOUGHT',
  'MECH',
  'WAR_SUN',
  'FLAGSHIP',
]

/** Reduce hits from the first pool */
export function reduceHits(
  state: CombatStateData,
  side: CombatSide,
  amount: number,
): CombatStateData {
  const sideState = state[side]
  if (sideState.hitPools.length === 0 || amount <= 0) return state

  const newPools = [...sideState.hitPools]
  newPools[0] = { ...newPools[0], hits: newPools[0].hits - amount }

  return {
    ...state,
    [side]: { ...sideState, hitPools: newPools },
  }
}

/** Add hits to a side's hit pool */
export function addHits(
  state: CombatStateData,
  side: CombatSide,
  hits: number,
  validTargets: UnitType[],
): CombatStateData {
  if (hits === 0) return state

  const sideState = state[side]
  const newPool: HitPool = { hits, validTargets }

  return {
    ...state,
    [side]: {
      ...sideState,
      hitPools: [...sideState.hitPools, newPool],
    },
  }
}

/** Update a specific unit's state */
export function updateUnit(
  state: CombatStateData,
  side: CombatSide,
  unitType: UnitType,
  unitIndex: number,
  updates: Partial<UnitState>,
): CombatStateData {
  const sideState = state[side]
  const units = sideState.units[unitType]
  if (!units || !units[unitIndex]) return state

  const newUnits = [...units]
  newUnits[unitIndex] = { ...newUnits[unitIndex], ...updates }

  return {
    ...state,
    [side]: {
      ...sideState,
      units: { ...sideState.units, [unitType]: newUnits },
    },
  }
}

/** Find a unit matching the predicate */
export function getUnit(
  sideState: SideState,
  unitType: UnitType,
  predicate: Partial<UnitState>,
): { unit: Unit; index: number } | undefined {
  const units = sideState.units[unitType]
  if (!units) return undefined

  const index = units.findIndex(unit =>
    Object.entries(predicate).every(
      ([key, value]) => unit[key as keyof UnitState] === value,
    ),
  )

  return index >= 0 ? { unit: units[index], index } : undefined
}

/** Destroy a specific unit by index */
export function destroyUnit(
  state: CombatStateData,
  side: CombatSide,
  unitType: UnitType,
  unitIndex: number,
): CombatStateData {
  const sideState = state[side]
  const units = sideState.units[unitType]
  if (!units || unitIndex < 0 || unitIndex >= units.length) return state

  const remaining = [
    ...units.slice(0, unitIndex),
    ...units.slice(unitIndex + 1),
  ]
  const newUnits = { ...sideState.units }

  if (remaining.length > 0) {
    newUnits[unitType] = remaining
  } else {
    delete newUnits[unitType]
  }

  return {
    ...state,
    [side]: {
      ...sideState,
      units: newUnits,
    },
  }
}

/** Collect dice for a specific combat phase */
export function collectDice(
  sideState: SideState,
  source: HitSource,
  participatingUnits: ReadonlySet<UnitType>,
): DicePool {
  const result: DicePool = {}

  // SPACE_CANNON and BOMBARDMENT are pre-combat abilities that fire regardless of
  // combat participation. PDS fires Space Cannon but is not a combat participant.
  // Ships with Bombardment fire at ground forces but may not participate in ground combat.
  const skipParticipatingFilter =
    source === 'SPACE_CANNON' || source === 'BOMBARDMENT'

  for (const [type, units] of Object.entries(sideState.units)) {
    if (!units || units.length === 0) continue
    if (!skipParticipatingFilter && !participatingUnits.has(type as UnitType))
      continue

    const unitType = type as UnitType

    // Check restrictions for unit ability sources
    if (source !== 'COMBAT') {
      if (
        isRestricted(sideState, 'lost', source, unitType) ||
        isRestricted(sideState, 'cannotBeUsed', source, unitType)
      ) {
        continue
      }
    }

    const firstUnit = units[0]
    if (!firstUnit) continue

    const dieValue =
      source === 'COMBAT'
        ? firstUnit.COMBAT
        : firstUnit.UNIT_ABILITIES?.[source]
    if (!dieValue) continue

    const [hitValue, dicePerUnit] = dieValue
    if (dicePerUnit <= 0) continue

    result[unitType] = units.map(() => [hitValue, dicePerUnit] as DiceData)
  }

  return result
}

/** Count total units, optionally filtered by participating units */
export function countUnits(
  sideState: SideState,
  participatingUnits?: ReadonlySet<UnitType>,
): number {
  let total = 0
  for (const [type, units] of Object.entries(sideState.units)) {
    if (!units) continue
    if (participatingUnits && !participatingUnits.has(type as UnitType))
      continue
    total += units.length
  }
  return total
}

/** Get sum of all pending hits across all pools */
export function getPendingHits(sideState: SideState): number {
  return sideState.hitPools.reduce((sum, pool) => sum + pool.hits, 0)
}

/** Assign hits from pools, destroying units in sacrifice order */
export function assignHits(
  state: CombatStateData,
  side: CombatSide,
  participatingUnits: ReadonlySet<UnitType>,
  unitPriority?: UnitType[],
): CombatStateData {
  const sideState = state[side]

  if (sideState.hitPools.length === 0) {
    return state
  }

  const baseOrder = unitPriority ?? DEFAULT_UNIT_SACRIFICE_ORDER
  const sacrificeOrder = baseOrder.filter(type => participatingUnits.has(type))
  let currentUnits = { ...sideState.units }

  for (const pool of sideState.hitPools) {
    currentUnits = destroyUnitsFromPool(
      currentUnits,
      pool.hits,
      pool.validTargets,
      sacrificeOrder,
    )
  }

  return {
    ...state,
    [side]: {
      ...sideState,
      units: currentUnits,
      hitPools: [],
    },
  }
}

function destroyUnitsFromPool(
  units: Partial<Record<UnitType, Unit[]>>,
  hits: number,
  validTargets: UnitType[],
  sacrificeOrder: UnitType[],
): Partial<Record<UnitType, Unit[]>> {
  if (hits <= 0) return units

  const targetSet = validTargets.length > 0 ? new Set(validTargets) : null
  const destroyCount = new Map<UnitType, number>()
  let remaining = hits

  for (const type of sacrificeOrder) {
    if (remaining <= 0) break
    if (targetSet && !targetSet.has(type)) continue
    const typeUnits = units[type]
    if (!typeUnits) continue
    const toDestroy = Math.min(typeUnits.length, remaining)
    destroyCount.set(type, toDestroy)
    remaining -= toDestroy
  }

  // Build new units object, removing destroyed units
  const newUnits: Partial<Record<UnitType, Unit[]>> = {}

  for (const [type, typeUnits] of Object.entries(units)) {
    const unitType = type as UnitType
    const removeCount = destroyCount.get(unitType) ?? 0
    const kept = typeUnits!.slice(removeCount)

    if (kept.length > 0) {
      newUnits[unitType] = kept
    }
  }

  return newUnits
}

/** Compare two unit maps and return which units were destroyed */
export function getDestroyedUnits(
  before: Partial<Record<UnitType, Unit[]>>,
  after: Partial<Record<UnitType, Unit[]>>,
): DestroyedUnit[] {
  const destroyed: DestroyedUnit[] = []

  for (const [type, beforeUnits] of Object.entries(before)) {
    if (!beforeUnits) continue
    const unitType = type as UnitType
    const afterUnits = after[unitType]
    const afterCount = afterUnits?.length ?? 0
    const destroyedCount = beforeUnits.length - afterCount

    for (let i = 0; i < destroyedCount; i++) {
      destroyed.push({ type: unitType, unit: beforeUnits[i] })
    }
  }

  return destroyed
}

/** Get the opposite side */
export function getOpponentSide(side: CombatSide): CombatSide {
  return side === 'attacker' ? 'defender' : 'attacker'
}

// ============================================================================
// UNIT ABILITY RESTRICTIONS
// ============================================================================

function addRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbilityKey,
  reason: string,
  unitType?: UnitType,
): UnitAbilityRestrictions {
  const current = restrictions ?? {}
  const layerData = current[layer] ?? {}
  const entries = layerData[ability] ?? []
  const entry: RestrictionEntry = unitType ? { reason, unitType } : { reason }

  return {
    ...current,
    [layer]: {
      ...layerData,
      [ability]: [...entries, entry],
    },
  }
}

function removeRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbilityKey,
  reason: string,
  unitType?: UnitType,
): UnitAbilityRestrictions | undefined {
  if (!restrictions) return undefined
  const layerData = restrictions[layer]
  if (!layerData) return restrictions
  const entries = layerData[ability]
  if (!entries) return restrictions

  const filtered = entries.filter(
    e => e.reason !== reason || e.unitType !== unitType,
  )

  const newLayerData = { ...layerData }
  if (filtered.length > 0) {
    newLayerData[ability] = filtered
  } else {
    delete newLayerData[ability]
  }

  const hasEntries = Object.keys(newLayerData).length > 0
  const result = {
    ...restrictions,
    [layer]: hasEntries ? newLayerData : undefined,
  }

  if (!result.lost && !result.cannotBeUsed) return undefined
  return result
}

function isRestricted(
  sideState: SideState,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbilityKey,
  unitType: UnitType,
): boolean {
  const entries = sideState.unitAbilityRestrictions?.[layer]?.[ability]
  if (!entries) return false

  return entries.some(e => !e.unitType || e.unitType === unitType)
}

function applyRestriction(
  state: CombatStateData,
  side: CombatSide,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbilityKey,
  reason: string,
  unitType?: UnitType,
): CombatStateData {
  const sideState = state[side]
  return {
    ...state,
    [side]: {
      ...sideState,
      unitAbilityRestrictions: addRestrictionEntry(
        sideState.unitAbilityRestrictions,
        layer,
        ability,
        reason,
        unitType,
      ),
    },
  }
}

function removeRestriction(
  state: CombatStateData,
  side: CombatSide,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbilityKey,
  reason: string,
  unitType?: UnitType,
): CombatStateData {
  const sideState = state[side]
  return {
    ...state,
    [side]: {
      ...sideState,
      unitAbilityRestrictions: removeRestrictionEntry(
        sideState.unitAbilityRestrictions,
        layer,
        ability,
        reason,
        unitType,
      ),
    },
  }
}

// --- "Lost" layer ---

/** Mark an ability as lost for a side (optionally for a specific unit type) */
export function setUnitAbilityLost(
  state: CombatStateData,
  side: CombatSide,
  ability: UnitAbilityKey,
  reason: string,
  unitType?: UnitType,
): CombatStateData {
  return applyRestriction(state, side, 'lost', ability, reason, unitType)
}

/** Remove a lost restriction entry */
export function removeUnitAbilityLost(
  state: CombatStateData,
  side: CombatSide,
  ability: UnitAbilityKey,
  reason: string,
  unitType?: UnitType,
): CombatStateData {
  return removeRestriction(state, side, 'lost', ability, reason, unitType)
}

/** Check if an ability is lost for a specific unit type */
export function isUnitAbilityLost(
  sideState: SideState,
  ability: UnitAbilityKey,
  unitType: UnitType,
): boolean {
  return isRestricted(sideState, 'lost', ability, unitType)
}

// --- "Cannot be used" layer ---

/** Mark an ability as cannot-be-used for a side (optionally for a specific unit type) */
export function setUnitAbilityCannotBeUsed(
  state: CombatStateData,
  side: CombatSide,
  ability: UnitAbilityKey,
  reason: string,
  unitType?: UnitType,
): CombatStateData {
  return applyRestriction(
    state,
    side,
    'cannotBeUsed',
    ability,
    reason,
    unitType,
  )
}

/** Remove a cannot-be-used restriction entry */
export function removeUnitAbilityCannotBeUsed(
  state: CombatStateData,
  side: CombatSide,
  ability: UnitAbilityKey,
  reason: string,
  unitType?: UnitType,
): CombatStateData {
  return removeRestriction(
    state,
    side,
    'cannotBeUsed',
    ability,
    reason,
    unitType,
  )
}

/** Check if an ability cannot be used for a specific unit type */
export function isUnitAbilityCannotBeUsed(
  sideState: SideState,
  ability: UnitAbilityKey,
  unitType: UnitType,
): boolean {
  return isRestricted(sideState, 'cannotBeUsed', ability, unitType)
}
