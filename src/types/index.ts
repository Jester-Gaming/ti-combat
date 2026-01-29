import baseUnits from '@/data/base-units'
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

// Unit dice definition: [hitValue, dicePerUnit]
// Used in unit stats for COMBAT, AFB, etc.
export type UnitDieValue = [number, number]

// Collected dice for combat: [hitValue, totalDiceCount, source]
// Source tracks which unit type generated the dice (for unit-specific modifiers)
export type DieValue = [number, number, UnitType]

// Unit abilities
export interface UnitAbilities {
  SUSTAIN_DAMAGE?: boolean
  BOMBARDMENT?: UnitDieValue
  AFB?: UnitDieValue
  SPACE_CANNON?: UnitDieValue
  PLANETARY_SHIELD?: boolean
  PRODUCTION?: number
}

export type UnitAbilityKey = keyof UnitAbilities

// Base unit stats (full definition for BASE variant)
export interface UnitDataStats {
  NAME?: string
  DESCRIPTION?: string
  COST?: number | null
  COMBAT?: UnitDieValue | null
  MOVE?: number | null
  CAPACITY?: number | null
  UNIT_ABILITIES?: UnitAbilities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ABILITIES?: readonly any[] // Use any to avoid circular dependency
}

// Unit definition with BASE and UPGRADED variants
export interface UnitDefinition {
  BASE: UnitDataStats | null
  UPGRADED?: Partial<UnitDataStats>
}

// Faction unit definitions
export type FactionUnits = Partial<Record<UnitType, UnitDefinition>>

// Faction abilities configuration
export interface FactionAbilities {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  faction: readonly any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promissory?: readonly any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent?: readonly any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commander?: readonly any[]
}

// Faction data structure
export interface Faction {
  name: string
  units: FactionUnits
  abilities?: FactionAbilities
}

// All faction keys
export type FactionKey = keyof typeof factions

// Unit state in the battle calculator
export interface UnitSelection {
  count: number
  upgraded: boolean
}

// Side identifier
export type Side = 'attacker' | 'defender'

// Side state (attacker or defender)
export interface SideState {
  faction: FactionKey
  units: Record<UnitType, UnitSelection>
}

// Combined battle state
export interface BattleState {
  attacker: SideState
  defender: SideState
}
