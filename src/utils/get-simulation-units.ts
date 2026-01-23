import {
  type SideState,
  UNIT_TYPES,
  type UnitStats,
  type UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

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
    const baseStats = unitDef.BASE
    const upgradedStats = unitDef.UPGRADED

    if (!baseStats && !upgradedStats) continue

    const effectiveStats = getEffectiveStats(
      baseStats,
      upgradedStats,
      unitState.upgraded,
    )
    if (!effectiveStats) continue

    stats[unitType] = effectiveStats
    counts[unitType] = unitState.count
  }

  return { stats, counts }
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
  // Use upgraded stats if unit is upgraded and has upgrades
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

  // Use base stats if available
  if (baseStats) {
    return { ...baseStats }
  }

  // Fallback to upgraded-only units (e.g., War Sun with BASE: null)
  if (upgradedStats) {
    return { ...upgradedStats } as UnitStats
  }

  return null
}
