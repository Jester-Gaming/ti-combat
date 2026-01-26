import { type FactionKey, UNIT_TYPES, type UnitType } from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

export const UNIT_DISPLAY_NAMES: Record<UnitType, string> = {
  FLAGSHIP: 'Flagship',
  WAR_SUN: 'War Sun',
  DREADNOUGHT: 'Dreadnought',
  CRUISER: 'Cruiser',
  CARRIER: 'Carrier',
  DESTROYER: 'Destroyer',
  FIGHTER: 'Fighter',
  MECH: 'Mech',
  INFANTRY: 'Infantry',
  PDS: 'PDS',
  SPACE_DOCK: 'Space Dock',
}

export interface UnitListItem {
  label: string
  value: UnitType
}

const unitList = [
  { value: 'FLAGSHIP', label: 'Flagship' },
  { value: 'WAR_SUN', label: 'War Sun' },
  { value: 'DREADNOUGHT', label: 'Dreadnought' },
  { value: 'CRUISER', label: 'Cruiser' },
  { value: 'CARRIER', label: 'Carrier' },
  { value: 'DESTROYER', label: 'Destroyer' },
  { value: 'FIGHTER', label: 'Fighter' },
  { value: 'MECH', label: 'Mech' },
  { value: 'INFANTRY', label: 'Infantry' },
  { value: 'PDS', label: 'PDS' },
  { value: 'SPACE_DOCK', label: 'Space Dock' },
] as const

/** Get unit list items for specific unit types */
export function getUnitListItems(units: readonly UnitType[]): UnitListItem[] {
  return unitList.filter(unit => units.includes(unit.value))
}

export interface UnitConfig {
  name: string
  hasUpgrade: boolean
}

export function getUnitConfig(
  factionKey: FactionKey,
): Record<UnitType, UnitConfig> {
  const factionUnitConfig = getFactionUnitConfig(factionKey)
  const result = {} as Record<UnitType, UnitConfig>

  for (const unitType of UNIT_TYPES) {
    const unitDef = factionUnitConfig[unitType]

    // Unit must have BOTH a BASE version AND an UPGRADED version to show upgrade button
    // Units with only UPGRADED (like War Sun with BASE: null) don't show upgrade button
    const hasBase = unitDef.BASE != null
    const hasUpgrade =
      hasBase &&
      unitDef.UPGRADED != null &&
      Object.keys(unitDef.UPGRADED).length > 0

    result[unitType] = {
      name: UNIT_DISPLAY_NAMES[unitType],
      hasUpgrade,
    }
  }

  return result
}
