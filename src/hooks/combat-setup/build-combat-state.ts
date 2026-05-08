import type {
  FactionKey,
  UnitBaseType,
  UnitIdList,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

import { CombatState } from '../../combat/combat-state/combat-state'
import type { UnitStatsEntry } from '../../combat/combat-state/types'
import type {
  CombatMode,
  SideAbilitiesConfig,
  SideStateData,
} from '../../combat/combat-state/types'
import { nextUnitIds } from '../../combat/utils/unit-id'
import { prepareSimulationConfig } from './prepare-simulation-config'

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface SideConfig {
  faction: FactionKey
  units: Partial<Record<UnitBaseType, number>>
  upgrades?: UnitBaseType[]
  abilities?: Record<string, true | Record<string, unknown>>
}

export interface CombatStateConfig {
  mode: CombatMode
  attacker: SideConfig
  defender: SideConfig
  customAbilities?: import('../../combat/abilities-engine/types').Ability[]
  /** Hook invoked after `prepareSimulationConfig` and before
   *  `forSimulation`, with mutable per-side registered ability arrays. Test
   *  harnesses use it to shuffle iteration order; production leaves it
   *  unset. */
  prepareAbilities?: (abilities: {
    attacker: import('../../combat/abilities-engine/types').RegisteredAbility[]
    defender: import('../../combat/abilities-engine/types').RegisteredAbility[]
  }) => void
}

// ============================================================================
// BUILDERS
// ============================================================================

function buildSideState(
  config: SideConfig,
  abilities: SideAbilitiesConfig,
): SideStateData {
  const upgradedSet = new Set(config.upgrades ?? [])
  let participatingUnits = ''
  const unitType: Record<string, UnitType> = {}
  const unitState: Record<string, UnitState> = {}
  const unitStats: Record<string, UnitStats> = {}

  const factionConfig = getFactionUnitConfig(config.faction)

  for (const [type, count] of Object.entries(config.units)) {
    const unitType_ = type as UnitBaseType
    if (!count || count <= 0) continue

    const def = factionConfig[unitType_]
    if (!def?.BASE) continue

    const upgraded = upgradedSet.has(unitType_)
    let stats: UnitStats = { ...def.BASE }
    if (upgraded && def.UPGRADED) {
      stats = {
        ...stats,
        ...def.UPGRADED,
        UNIT_ABILITIES: {
          ...stats.UNIT_ABILITIES,
          ...def.UPGRADED.UNIT_ABILITIES,
        },
      }
    }

    const ids = nextUnitIds(count)
    for (const id of ids) {
      participatingUnits += id
      unitType[id] = unitType_ as import('@/types').UnitType
    }
    unitStats[unitType_] = stats
  }

  return {
    faction: config.faction,
    participatingUnits: participatingUnits as UnitIdList,
    nonParticipatingUnits: '' as UnitIdList,
    unitType,
    unitState,
    unitStats: {
      ...buildUnitStatsMap(config.faction, upgradedSet),
      ...unitStats,
    } as Record<import('@/types').UnitType, UnitStatsEntry>,
    hitPools: [],
    abilities,
    liveAbilities: {},
  }
}

function buildSideAbilitiesConfig(config: SideConfig): SideAbilitiesConfig {
  const result: SideAbilitiesConfig = {}
  if (!config.abilities) return result

  for (const [key, value] of Object.entries(config.abilities)) {
    if (value === true) {
      result[key] = { isEnabled: true }
    } else {
      result[key] = { ...value }
    }
  }
  return result
}

// ============================================================================
// FACTORY
// ============================================================================

export function buildCombatState(config: CombatStateConfig): CombatState {
  const abilitiesConfig = {
    attacker: buildSideAbilitiesConfig(config.attacker),
    defender: buildSideAbilitiesConfig(config.defender),
  }

  const sideAbilities = prepareSimulationConfig(
    abilitiesConfig,
    config.attacker.faction,
    config.defender.faction,
    config.mode,
    config.customAbilities,
  )

  const attackerSide = buildSideState(config.attacker, abilitiesConfig.attacker)
  const defenderSide = buildSideState(config.defender, abilitiesConfig.defender)

  config.prepareAbilities?.({
    attacker: sideAbilities.attacker.registered,
    defender: sideAbilities.defender.registered,
  })

  return CombatState.forSimulation(
    attackerSide,
    defenderSide,
    config.mode,
    {
      attacker: sideAbilities.attacker.registered,
      defender: sideAbilities.defender.registered,
    },
    {
      attacker: sideAbilities.attacker.unitAbilityKeys,
      defender: sideAbilities.defender.unitAbilityKeys,
    },
    {
      attacker: sideAbilities.attacker.factionOwnedKeys,
      defender: sideAbilities.defender.factionOwnedKeys,
    },
  )
}
