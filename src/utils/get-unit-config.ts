import { UNIT_DISPLAY_NAMES, UNIT_TYPES } from '@/constants/units'
import { type FactionKey, type UnitType } from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

export interface UnitListItem {
  label: string
  value: UnitType
}

const unitList: UnitListItem[] = UNIT_TYPES.map(value => ({
  value,
  label: UNIT_DISPLAY_NAMES[value],
}))

/** Get unit list items for specific unit types */
export function getUnitListItems(units: readonly UnitType[]): UnitListItem[] {
  return unitList.filter(unit => units.includes(unit.value))
}

/** Get display name for a unit type with optional subtypes */
export function getUnitVariantDisplayName(
  unitType: UnitType,
  subtypes?: string[],
): string {
  const base = UNIT_DISPLAY_NAMES[unitType]
  if (!subtypes || subtypes.length === 0) return base
  return `${base} (${subtypes.join(', ')})`
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
