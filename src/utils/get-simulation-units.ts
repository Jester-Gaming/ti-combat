import { nextUnitIds } from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import type {
  FactionKey,
  UnitBaseType,
  UnitId,
  UnitSelection,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

/**
 * Converts faction + unit selections into compact unit data for combat simulation.
 * Returns UnitId arrays and stats maps keyed by variant key (base type only at creation).
 */
export function getSimulationUnits(
  faction: FactionKey,
  selections: Record<UnitBaseType, UnitSelection>,
): {
  units: UnitId[]
  unitType: Record<UnitId, UnitType>
  unitState: Record<number, UnitState>
  unitStats: Record<string, UnitStats>
} {
  const factionConfig = getFactionUnitConfig(faction)
  const units: UnitId[] = []
  const unitType: Record<UnitId, UnitType> = {}
  const unitState: Record<number, UnitState> = {}
  const unitStats: Record<string, UnitStats> = {}

  for (const baseType of UNIT_TYPES) {
    const sel = selections[baseType]
    if (sel.count === 0) continue

    const unitDef = factionConfig[baseType]
    const baseStats = unitDef.BASE
    const upgradedStats = unitDef.UPGRADED

    if (!baseStats && !upgradedStats) continue

    const effectiveStats = getEffectiveStats(
      baseStats,
      upgradedStats,
      sel.upgraded,
    )
    if (!effectiveStats) continue

    const ids = nextUnitIds(sel.count)
    for (const id of ids) {
      units.push(id)
      unitType[id] = baseType as UnitType
    }
    unitStats[baseType] = effectiveStats
  }

  // Returns a flat id list — the caller places them into
  // `participatingUnits` and lets `sortUnitsAtSetup` split out the
  // non-participating tail.
  return { units, unitType, unitState, unitStats }
}

/**
 * Builds a map of original unit stats templates for all unit types
 * that have valid definitions. Used by placeUnits to initialize new units
 * with correct (unmodified) stats.
 */
export function buildUnitStatsMap(
  faction: FactionKey,
  upgrades?: ReadonlySet<UnitBaseType>,
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
