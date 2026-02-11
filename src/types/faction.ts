import type { Ability } from '@/combat/abilities'
import factions from '@/data/faction'

import type { UnitDefinition, UnitType } from './unit'

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
  units: Partial<Record<UnitType, UnitDefinition>>
  abilities?: FactionAbilities
}

// All faction keys
export type FactionKey = keyof typeof factions
