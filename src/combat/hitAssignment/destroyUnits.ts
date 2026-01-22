import type { UnitType } from '@/types'
import type { CombatSideState, Unit } from '../types'

const UNIT_SACRIFICE_ORDER: UnitType[] = [
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

/**
 * Core hit assignment: destroys cheapest units first.
 * Does NOT handle sustain damage - that's an ability that runs before this.
 */
export function destroyUnits(
  state: CombatSideState,
  validTargets?: UnitType[],
): CombatSideState {
  const { units, pendingHits } = state

  if (pendingHits === 0) return state

  const targetSet = validTargets ? new Set(validTargets) : null

  // Build list of (type, index) for all destroyable units in sacrifice order
  const destroyable: Array<{ type: UnitType; index: number }> = []

  for (const type of UNIT_SACRIFICE_ORDER) {
    if (targetSet && !targetSet.has(type)) continue
    const typeUnits = units[type]
    if (!typeUnits) continue

    for (let i = 0; i < typeUnits.length; i++) {
      destroyable.push({ type, index: i })
    }
  }

  // Determine which units to destroy
  const toDestroy = destroyable.slice(0, pendingHits)
  const destroyCount = new Map<UnitType, number>()

  for (const { type } of toDestroy) {
    destroyCount.set(type, (destroyCount.get(type) ?? 0) + 1)
  }

  // Build new units object
  const newUnits: Partial<Record<UnitType, Unit[]>> = {}

  for (const [type, typeUnits] of Object.entries(units)) {
    const unitType = type as UnitType
    const removeCount = destroyCount.get(unitType) ?? 0
    const remaining = typeUnits!.slice(removeCount)

    if (remaining.length > 0) {
      newUnits[unitType] = remaining
    }
  }

  const remainingHits = Math.max(0, pendingHits - toDestroy.length)

  return { stats: state.stats, units: newUnits, pendingHits: remainingHits }
}
