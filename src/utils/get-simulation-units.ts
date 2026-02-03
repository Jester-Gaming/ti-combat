import { UNIT_TYPES } from '@/constants/units'
import type {
  FactionKey,
  Unit,
  UnitSelection,
  UnitStats,
  UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

/**
 * Converts faction + unit selections into a unit map for combat simulation.
 * Each unit has both stats (COMBAT, UNIT_ABILITIES) and state (isDamaged).
 */
export function getSimulationUnits(
  faction: FactionKey,
  selections: Record<UnitType, UnitSelection>,
): Partial<Record<UnitType, Unit[]>> {
  const factionConfig = getFactionUnitConfig(faction)
  const units: Partial<Record<UnitType, Unit[]>> = {}

  for (const unitType of UNIT_TYPES) {
    const unitState = selections[unitType]
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
  baseStats: UnitStats,
  upgradedStats: Partial<UnitStats> | undefined,
  isUpgraded: boolean,
): UnitStats | null {
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

  return null
}
