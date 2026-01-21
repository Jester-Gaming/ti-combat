import { UNIT_TYPES, type FactionKey, type UnitType } from '@/types'
import { getFactionUnitConfig } from './getFactionUnitConfig'

const UNIT_DISPLAY_NAMES: Record<UnitType, string> = {
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
    const effectiveUnit = factionUnitConfig[unitType]

    // Determine hasUpgrade: unit must have BOTH a BASE version AND an UPGRADED version
    // Units with only UPGRADED (like War Sun with BASE: null) don't show upgrade button
    const hasBase =
      effectiveUnit.BASE !== null && effectiveUnit.BASE !== undefined
    const hasUpgradedContent =
      effectiveUnit.UPGRADED && Object.keys(effectiveUnit.UPGRADED).length > 0
    const hasUpgrade = hasBase && !!hasUpgradedContent

    result[unitType] = {
      name: UNIT_DISPLAY_NAMES[unitType],
      hasUpgrade,
    }
  }

  return result
}
