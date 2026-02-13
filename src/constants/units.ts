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

export const UNIT_PRICE: Record<UnitType, number> = {
  WAR_SUN: 12,
  FLAGSHIP: 8,
  DREADNOUGHT: 4,
  CARRIER: 3,
  PDS: 3,
  MECH: 2,
  CRUISER: 2,
  DESTROYER: 1,
  FIGHTER: 0.5,
  INFANTRY: 0.5,
  SPACE_DOCK: 0,
}

export const UNIT_LIMITS: Record<UnitType, number> = {
  FLAGSHIP: 1,
  WAR_SUN: 2,
  DREADNOUGHT: 5,
  CARRIER: 4,
  CRUISER: 8,
  DESTROYER: 8,
  FIGHTER: 99,
  MECH: 4,
  INFANTRY: 99,
  PDS: 6,
  SPACE_DOCK: 3,
}

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

export const UNIT_SHORT_NAMES: Record<UnitType, string> = {
  FLAGSHIP: 'Fl',
  WAR_SUN: 'WS',
  DREADNOUGHT: 'Dn',
  CRUISER: 'Cr',
  CARRIER: 'Ca',
  DESTROYER: 'De',
  FIGHTER: 'Fi',
  MECH: 'Me',
  INFANTRY: 'In',
  PDS: 'PD',
  SPACE_DOCK: 'SD',
}
