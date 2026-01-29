import type { Unit } from '@/combat'
import {
  type SideState,
  UNIT_TYPES,
  type UnitDataStats,
  type UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

/**
 * Converts a SideState to a unit map suitable for SideState.
 * Each unit has both stats (COMBAT, UNIT_ABILITIES) and state (isDamaged).
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

    // Create unit instances with stats (each needs its own object for mutable state like isDamaged)
    units[unitType] = Array.from({ length: unitState.count }, () => ({
      ...effectiveStats,
    }))
  }

  return units
}

/**
 * Merges BASE and UPGRADED stats based on upgrade status.
 * Returns null if no valid stats exist.
 */
function getEffectiveStats(
  baseStats: UnitDataStats | null | undefined,
  upgradedStats: Partial<UnitDataStats> | undefined,
  isUpgraded: boolean,
): UnitDataStats | null {
  if (isUpgraded && upgradedStats) {
    return {
      ...baseStats,
      ...upgradedStats,
      UNIT_ABILITIES: {
        ...baseStats?.UNIT_ABILITIES,
        ...upgradedStats.UNIT_ABILITIES,
      },
    }
  }

  if (baseStats) {
    return { ...baseStats }
  }

  if (upgradedStats) {
    return { ...upgradedStats }
  }

  return null
}
