import type { UnitType } from '../types/unit'

export const NON_FIGHTER_SHIPS: UnitType[] = [
  'FLAGSHIP',
  'WAR_SUN',
  'DREADNOUGHT',
  'CARRIER',
  'CRUISER',
  'DESTROYER',
]

export const SHIPS: UnitType[] = [...NON_FIGHTER_SHIPS, 'FIGHTER']

export const GROUND_FORCES: UnitType[] = ['MECH', 'INFANTRY']

export const STRUCTURES: UnitType[] = ['PDS', 'SPACE_DOCK']

export const UNIT_TYPES: UnitType[] = [
  ...SHIPS,
  ...GROUND_FORCES,
  ...STRUCTURES,
]

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
