import { getFactionUnitConfig } from './getFactionUnitConfig'
import {
  type UnitType,
  type UnitStats,
  type SideState,
  UNIT_TYPES,
} from '@/types'

export interface SimulationUnits {
  stats: Partial<Record<UnitType, UnitStats>>
  counts: Partial<Record<UnitType, number>>
}

/**
 * Converts a SideState to the format expected by simulateCombat.
 * Returns unit stats (with upgrades applied) and counts for units with count > 0.
 */
export function getSimulationUnits(side: SideState): SimulationUnits {
  const factionConfig = getFactionUnitConfig(side.faction)
  const stats: Partial<Record<UnitType, UnitStats>> = {}
  const counts: Partial<Record<UnitType, number>> = {}

  for (const unitType of UNIT_TYPES) {
    const unitState = side.units[unitType]
    if (unitState.count === 0) continue

    const unitDef = factionConfig[unitType]
    if (!unitDef.BASE && !unitDef.UPGRADED) continue

    // Get effective stats: merge BASE with UPGRADED if upgraded
    let effectiveStats: UnitStats
    if (unitState.upgraded && unitDef.UPGRADED) {
      // Merge BASE (if exists) with UPGRADED
      effectiveStats = {
        ...unitDef.BASE,
        ...unitDef.UPGRADED,
        ABILITIES: {
          ...unitDef.BASE?.ABILITIES,
          ...unitDef.UPGRADED.ABILITIES,
        },
      }
    } else if (unitDef.BASE) {
      effectiveStats = { ...unitDef.BASE }
    } else if (unitDef.UPGRADED) {
      // Units like War Sun that only have UPGRADED
      effectiveStats = { ...unitDef.UPGRADED }
    } else {
      continue
    }

    stats[unitType] = effectiveStats
    counts[unitType] = unitState.count
  }

  return { stats, counts }
}
