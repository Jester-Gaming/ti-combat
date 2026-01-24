import type { DieValue, UnitType } from '@/types'

import type {
  CombatSide,
  CombatStateData,
  HitPool,
  SideState,
  Unit,
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

  const index = units.findIndex(unit => {
    for (const [key, value] of Object.entries(predicate)) {
      if (unit[key as keyof UnitState] !== value) return false
    }
    return true
  })

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
  source: 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON',
  participatingUnits: ReadonlySet<UnitType>,
): DieValue[] {
  const result: DieValue[] = []

  for (const [type, units] of Object.entries(sideState.units)) {
    if (!units || units.length === 0) continue
    if (!participatingUnits.has(type as UnitType)) continue

    const firstUnit = units[0]
    if (!firstUnit) continue

    const dieValue =
      source === 'COMBAT' ? firstUnit.COMBAT : firstUnit.ABILITIES?.[source]
    if (!dieValue) continue

    const [hitValue, dicePerUnit] = dieValue
    if (dicePerUnit <= 0) continue

    const totalDice = units.length * dicePerUnit
    result.push([hitValue, totalDice, type as UnitType])
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
      participatingUnits,
    )
  }

  // Clean up empty unit arrays
  const cleanedUnits: Partial<Record<UnitType, Unit[]>> = {}
  for (const [type, unitList] of Object.entries(currentUnits)) {
    if (unitList && unitList.length > 0) {
      cleanedUnits[type as UnitType] = unitList
    }
  }

  return {
    ...state,
    [side]: {
      ...sideState,
      units: cleanedUnits,
      hitPools: [],
    },
  }
}

function destroyUnitsFromPool(
  units: Partial<Record<UnitType, Unit[]>>,
  hits: number,
  validTargets: UnitType[],
  sacrificeOrder: UnitType[],
  participatingUnits: ReadonlySet<UnitType>,
): Partial<Record<UnitType, Unit[]>> {
  if (hits <= 0) return units

  const targetSet = validTargets.length > 0 ? new Set(validTargets) : null

  // Build list of destroyable units in sacrifice order
  const destroyable: Array<{ type: UnitType }> = []

  for (const type of sacrificeOrder) {
    if (targetSet && !targetSet.has(type)) continue
    if (!participatingUnits.has(type)) continue
    const typeUnits = units[type]
    if (!typeUnits) continue

    for (let i = 0; i < typeUnits.length; i++) {
      destroyable.push({ type })
    }
  }

  // Count units to destroy per type
  const toDestroy = destroyable.slice(0, hits)
  const destroyCount = new Map<UnitType, number>()

  for (const { type } of toDestroy) {
    destroyCount.set(type, (destroyCount.get(type) ?? 0) + 1)
  }

  // Build new units object, removing destroyed units
  const newUnits: Partial<Record<UnitType, Unit[]>> = {}

  for (const [type, typeUnits] of Object.entries(units)) {
    const unitType = type as UnitType
    const removeCount = destroyCount.get(unitType) ?? 0
    const remaining = typeUnits!.slice(removeCount)

    if (remaining.length > 0) {
      newUnits[unitType] = remaining
    }
  }

  return newUnits
}

/** Get the opposite side */
export function getOpponentSide(side: CombatSide): CombatSide {
  return side === 'attacker' ? 'defender' : 'attacker'
}
