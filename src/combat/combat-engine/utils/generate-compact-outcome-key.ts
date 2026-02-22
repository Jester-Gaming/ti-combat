import type { UnitBaseType, UnitId, UnitState, UnitType } from '@/types'

import type { SideStateData } from '../../combat-state/types'
import { parseVariantId } from '../../utils/unit-variant'

/**
 * Generate a unique outcome key directly from compact state.
 * Avoids creating intermediate SurvivorUnit objects.
 */
export function generateCompactOutcomeKey(
  attackerData: SideStateData,
  defenderData: SideStateData,
  attackerParticipating: ReadonlySet<UnitBaseType>,
  defenderParticipating: ReadonlySet<UnitBaseType>,
): string {
  return `${formatCompactSideKey(attackerData.units, attackerData.unitState, attackerParticipating)}|${formatCompactSideKey(defenderData.units, defenderData.unitState, defenderParticipating)}`
}

function formatCompactSideKey(
  units: Record<string, UnitId[]>,
  unitState: Record<number, UnitState>,
  participating: ReadonlySet<UnitBaseType>,
): string {
  const keys = Object.keys(units)
  if (keys.length === 0) return ''
  if (keys.length > 1) keys.sort()

  let result = ''
  for (const key of keys) {
    const ids = units[key]
    if (!ids || ids.length <= 0) continue
    const { type } = parseVariantId(key as UnitType)
    if (!participating.has(type)) continue

    if (result) result += ','

    let damaged = 0
    for (const id of ids) {
      if (unitState[id]?.isDamaged) damaged++
    }
    if (damaged === 0) {
      result += key + ':' + ids.length
    } else {
      result += key + ':' + ids.length + 'd' + damaged
    }
  }
  return result
}
