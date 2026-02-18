import { UNIT_TYPES } from '@/constants/units'
import type {
  FactionKey,
  UnitSelection,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

/**
 * Converts faction + unit selections into compact unit data for combat simulation.
 * Returns counts and stats maps keyed by variant key (base type only at creation).
 */
export function getSimulationUnits(
  faction: FactionKey,
  selections: Record<UnitType, UnitSelection>,
): {
  units: Record<string, number>
  unitState: Record<string, UnitState[]>
  unitStats: Record<string, UnitStats>
} {
  const factionConfig = getFactionUnitConfig(faction)
  const units: Record<string, number> = {}
  const unitState: Record<string, UnitState[]> = {}
  const unitStats: Record<string, UnitStats> = {}

  for (const unitType of UNIT_TYPES) {
    const sel = selections[unitType]
    if (sel.count === 0) continue

    const unitDef = factionConfig[unitType]
    const baseStats = unitDef.BASE
    const upgradedStats = unitDef.UPGRADED

    if (!baseStats && !upgradedStats) continue

    const effectiveStats = getEffectiveStats(
      baseStats,
      upgradedStats,
      sel.upgraded,
    )
    if (!effectiveStats) continue

    units[unitType] = sel.count
    unitState[unitType] = []
    unitStats[unitType] = effectiveStats
  }

  return { units, unitState, unitStats }
}

/**
 * Builds a map of original unit stats templates for all unit types
 * that have valid definitions. Used by addUnit to initialize new units
 * with correct (unmodified) stats.
 */
export function buildUnitStatsMap(
  faction: FactionKey,
  upgrades?: ReadonlySet<UnitType>,
): Record<string, UnitStats> {
  const factionConfig = getFactionUnitConfig(faction)
  const result: Record<string, UnitStats> = {}

  for (const unitType of UNIT_TYPES) {
    const unitDef = factionConfig[unitType]
    if (!unitDef?.BASE) continue
    result[unitType] = getEffectiveStats(
      unitDef.BASE,
      unitDef.UPGRADED,
      upgrades?.has(unitType) ?? false,
    )
  }

  return result
}

/**
 * Merges BASE and UPGRADED stats based on upgrade status.
 * Returns null if no valid stats exist.
 */
export function getEffectiveStats(
  baseStats: UnitStats,
  upgradedStats: Partial<UnitStats> | undefined,
  isUpgraded: boolean,
): UnitStats {
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

  return { ...baseStats }
}
