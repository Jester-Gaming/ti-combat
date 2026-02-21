import type { Ability } from '@/combat/abilities'
import type baseUnits from '@/data/base-units'

import type { DiceGroup } from './die'

export type UnitBaseType = keyof typeof baseUnits | 'FLAGSHIP' | 'MECH'
export type UnitVariant = `${UnitBaseType}:${string}`
export type UnitType = UnitBaseType | UnitVariant

// Unit abilities
export interface UnitAbilities {
  SUSTAIN_DAMAGE?: boolean
  BOMBARDMENT?: DiceGroup
  AFB?: DiceGroup
  SPACE_CANNON?: DiceGroup
  PLANETARY_SHIELD?: boolean
  PRODUCTION?: number
}

export type UnitAbility = keyof UnitAbilities

export interface UnitStats {
  NAME?: string
  DESCRIPTION?: string
  COST?: number | null
  COMBAT?: DiceGroup | null
  MOVE?: number | null
  CAPACITY?: number | null
  DIRECT_HIT_IMMUNE?: boolean
  UNIT_ABILITIES?: UnitAbilities
  ABILITIES?: readonly Ability[]
}

export interface UnitDefinition {
  BASE: UnitStats
  UPGRADED?: Partial<UnitStats>
}

export interface UnitState {
  isDamaged?: boolean
  usedSustainThisRound?: boolean
}

export const UNIT_STATE_KEYS = new Set<string>([
  'isDamaged',
  'usedSustainThisRound',
])

export type Unit = UnitStats &
  UnitState & {
    subtypes?: string[]
  }

/** Locator for a unit within compact state */
export interface UnitLocator {
  key: string
  index: number
}
