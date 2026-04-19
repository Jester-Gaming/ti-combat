import type { UnitAbility, UnitBaseType } from '../types/unit'

export const NON_FIGHTER_SHIPS: UnitBaseType[] = [
  'FLAGSHIP',
  'WAR_SUN',
  'DREADNOUGHT',
  'CARRIER',
  'CRUISER',
  'DESTROYER',
]

export const SHIPS: UnitBaseType[] = [...NON_FIGHTER_SHIPS, 'FIGHTER']

export const GROUND_FORCES: UnitBaseType[] = ['MECH', 'INFANTRY']

export const STRUCTURES: UnitBaseType[] = ['PDS', 'SPACE_DOCK']

export const UNIT_ABILITIES: UnitAbility[] = [
  'AFB',
  'BOMBARDMENT',
  'DEPLOY',
  'SPACE_CANNON',
  'SUSTAIN_DAMAGE',
  'PLANETARY_SHIELD',
]

export type UnitCategory = keyof typeof UNIT_CATEGORIES

export const UNIT_CATEGORIES = {
  SHIPS,
  NON_FIGHTER_SHIPS,
  GROUND_FORCES,
  STRUCTURES,
} as const

export const UNIT_TYPES: UnitBaseType[] = [
  ...SHIPS,
  ...GROUND_FORCES,
  ...STRUCTURES,
]

export const UNIT_PRICE: Record<UnitBaseType, number> = {
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

export const UNIT_LIMITS: Record<UnitBaseType, number> = {
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

export const UNIT_DISPLAY_NAMES: Record<UnitBaseType, string> = {
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

export const UNIT_SHORT_NAMES: Record<UnitBaseType, string> = {
  FLAGSHIP: 'Fl',
  WAR_SUN: 'W',
  DREADNOUGHT: 'D',
  CRUISER: 'Cr',
  CARRIER: 'Ca',
  DESTROYER: 'De',
  FIGHTER: 'F',
  MECH: 'M',
  INFANTRY: 'I',
  PDS: 'PDS',
  SPACE_DOCK: 'SD',
}
