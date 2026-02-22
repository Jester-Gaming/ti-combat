import type { Ability } from '@/combat/abilities-engine'
import factions from '@/data/faction'

import type { UnitBaseType, UnitDefinition } from './unit'

interface FactionAbilities {
  faction?: readonly Ability[]
  technology?: readonly Ability[]
  unit?: readonly Ability[]
  promissory?: readonly Ability[]
  agent?: readonly Ability[]
  commander?: readonly Ability[]
  hero?: readonly Ability[]
  breakthrough?: readonly Ability[]
}

// Faction data structure
export interface Faction {
  name: string
  icon?: string
  units: Partial<Record<UnitBaseType, UnitDefinition>>
  abilities?: FactionAbilities
}

// All faction keys
export type FactionKey = keyof typeof factions
