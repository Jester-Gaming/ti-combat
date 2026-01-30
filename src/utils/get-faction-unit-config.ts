import { UNIT_TYPES } from '@/constants/units'
import baseUnits from '@/data/base-units'
import factions from '@/data/faction'
import { type FactionKey, type UnitDefinition, type UnitType } from '@/types'

/**
 * Returns merged unit definitions for a faction.
 * Structure is identical to base_units.json: Record<UnitType, UnitDefinition>
 * Faction-specific units override base units.
 */
export function getFactionUnitConfig(
  factionKey: FactionKey,
): Record<UnitType, UnitDefinition> {
  const faction = factions[factionKey]
  const factionUnits = faction.units
  const result = {} as Record<UnitType, UnitDefinition>

  for (const unitType of UNIT_TYPES) {
    const baseUnit = baseUnits[
      unitType as keyof typeof baseUnits
    ] as UnitDefinition
    const factionUnit = factionUnits[unitType]

    // Faction unit takes precedence, otherwise use base unit
    // Default to { BASE: null } if neither exists
    result[unitType] = factionUnit ?? baseUnit ?? { BASE: null }
  }

  return result
}
