import type { Unit } from '@/combat'
import {
  type SideState,
  UNIT_TYPES,
  type UnitStats,
  type UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

/**
 * Converts a SideState to a unit map suitable for CombatSideState.
 * Each unit has both stats (COMBAT, ABILITIES) and state (isDamaged).
 */
export function getSimulationUnits(
  side: SideState,
): Partial<Record<UnitType, Unit[]>> {
  const factionConfig = getFactionUnitConfig(side.faction)
  const units: Partial<Record<UnitType, Unit[]>> = {}

  for (const unitType of UNIT_TYPES) {
    const unitState = side.units[unitType]
    if (unitState.count === 0) continue

    const unitDef = factionConfig[unitType]
    const baseStats = unitDef.BASE
    const upgradedStats = unitDef.UPGRADED

    if (!baseStats && !upgradedStats) continue

    const effectiveStats = getEffectiveStats(
      baseStats,
      upgradedStats,
      unitState.upgraded,
    )
    if (!effectiveStats) continue

    // Create unit instances with stats
    units[unitType] = Array.from({ length: unitState.count }, () => ({
      COMBAT: effectiveStats.COMBAT,
      ABILITIES: effectiveStats.ABILITIES,
    }))
  }

  return units
}

/**
 * Merges BASE and UPGRADED stats based on upgrade status.
 * Returns null if no valid stats exist.
 */
function getEffectiveStats(
  baseStats: UnitStats | null | undefined,
  upgradedStats: Partial<UnitStats> | undefined,
  isUpgraded: boolean,
): UnitStats | null {
  if (isUpgraded && upgradedStats) {
    return {
      ...baseStats,
      ...upgradedStats,
      ABILITIES: {
        ...baseStats?.ABILITIES,
        ...upgradedStats.ABILITIES,
      },
    }
  }

  if (baseStats) {
    return { ...baseStats }
  }

  if (upgradedStats) {
    return { ...upgradedStats } as UnitStats
  }

  return null
}
