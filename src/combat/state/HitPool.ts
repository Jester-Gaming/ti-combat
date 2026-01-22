import type { UnitType } from '@/types'

/** Source of combat hits - determines valid targets */
export type HitSource = 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON'

/** A pool of unassigned hits with source and valid targets */
export interface HitPool {
  source: HitSource
  hits: number
  validTargets: UnitType[] // Empty = all units valid
}

/** Ships that can be targeted in space combat */
export const SHIP_TYPES: UnitType[] = [
  'FLAGSHIP',
  'WAR_SUN',
  'DREADNOUGHT',
  'CRUISER',
  'CARRIER',
  'DESTROYER',
  'FIGHTER',
]

/** Ground forces that can be targeted by bombardment */
export const GROUND_FORCE_TYPES: UnitType[] = ['INFANTRY', 'MECH']

/** Valid targets by hit source */
export function getValidTargets(source: HitSource): UnitType[] {
  switch (source) {
    case 'COMBAT':
      return [] // All ships valid (empty = all)
    case 'AFB':
      return ['FIGHTER']
    case 'BOMBARDMENT':
      return GROUND_FORCE_TYPES
    case 'SPACE_CANNON':
      return [] // All ships valid
  }
}
