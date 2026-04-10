import type { Ability } from '@/combat'
import type baseUnits from '@/data/base-units'

import type { DiceGroup } from './die'

export type UnitVariantId = string & { readonly __brand: 'UnitVariantId' }

export type UnitBaseType = keyof typeof baseUnits | 'FLAGSHIP' | 'MECH'
type UnitVariant = `${UnitBaseType}:${UnitVariantId}`
export type UnitType = UnitBaseType | UnitVariant

// Unit abilities
interface UnitAbilities {
  SUSTAIN_DAMAGE?: boolean
  BOMBARDMENT?: DiceGroup
  AFB?: DiceGroup
  SPACE_CANNON?: DiceGroup
  PLANETARY_SHIELD?: boolean
  PRODUCTION?: number
  DEPLOY?: Ability
}

export type UnitAbility = keyof UnitAbilities

export interface UnitStats {
  NAME?: string
  DESCRIPTION?: string
  COST?: number | null
  COMBAT?: DiceGroup | null
  MOVE?: number | null
  CAPACITY?: number | null
  CAPACITY_COST?: number | null
  FLEET_POOL_COST?: number
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

export type Unit = UnitStats &
  UnitState & {
    subtypes?: string[]
  }

/** Branded unique identifier for a unit instance */
export type UnitId = number & { readonly __brand: 'UnitId' }
