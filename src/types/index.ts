import baseUnits from '@/data/base_units.json'
import factions from '@/data/faction'

export type UnitType = keyof typeof baseUnits | 'FLAGSHIP' | 'MECH'

export const UNIT_TYPES: UnitType[] = [
  'FLAGSHIP',
  'WAR_SUN',
  'DREADNOUGHT',
  'CARRIER',
  'CRUISER',
  'DESTROYER',
  'FIGHTER',
  'MECH',
  'INFANTRY',
  'PDS',
  'SPACE_DOCK',
]

// Combat roll: [hitValue, diceCount]
export type DieValue = [number, number]

// Unit abilities
export interface UnitAbilities {
  SUSTAIN_DAMAGE?: boolean
  BOMBARDMENT?: DieValue
  AFB?: DieValue
  SPACE_CANNON?: DieValue
  PLANETARY_SHIELD?: boolean
  PRODUCTION?: number
}

// Base unit stats (full definition for BASE variant)
export interface UnitStats {
  NAME?: string
  DESCRIPTION?: string
  COST?: number | null
  COMBAT?: DieValue | null
  MOVE?: number | null
  CAPACITY?: number | null
  ABILITIES?: UnitAbilities
}

// Upgraded unit stats (partial, inherits from BASE)
export type UnitUpgrade = Partial<UnitStats>

// Unit definition with BASE and UPGRADED variants
export interface UnitDefinition {
  BASE: UnitStats | null
  UPGRADED?: UnitUpgrade
}

// Faction unit definitions
export type FactionUnits = Partial<Record<UnitType, UnitDefinition>>

// Faction data structure
export interface Faction {
  name: string
  units: FactionUnits
}

// Base units data structure
export type BaseUnits = Record<string, UnitDefinition>

// All faction keys
export type FactionKey = keyof typeof factions

// Unit state in the battle calculator
export interface UnitState {
  count: number
  upgraded: boolean
}

// Side identifier
export type Side = 'attacker' | 'defender'

// Side state (attacker or defender)
export interface SideState {
  faction: FactionKey
  units: Record<UnitType, UnitState>
}

// Combined battle state
export interface BattleState {
  attacker: SideState
  defender: SideState
}
