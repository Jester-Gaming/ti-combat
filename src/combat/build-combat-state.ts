import type { FactionKey, UnitBaseType, UnitState, UnitStats } from '@/types'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

import { CombatState } from './combat-state/combat-state'
import type {
  AbilitiesConfig,
  CombatMode,
  SideStateData,
} from './combat-state/types'

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
}

// ============================================================================
// BUILDERS
// ============================================================================

function buildSideState(config: SideConfig): SideStateData {
  const upgradedSet = new Set(config.upgrades ?? [])
  const units: Record<string, number> = {}
  const unitState: Record<string, UnitState[]> = {}
  const unitStats: Record<string, UnitStats> = {}

  const factionConfig = getFactionUnitConfig(config.faction)

  for (const [type, count] of Object.entries(config.units)) {
    const unitType = type as UnitBaseType
    if (!count || count <= 0) continue

    const def = factionConfig[unitType]
    if (!def?.BASE) continue

    const upgraded = upgradedSet.has(unitType)
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

    units[unitType] = count
    unitState[unitType] = []
    unitStats[unitType] = stats
  }

  return {
    faction: config.faction,
    units,
    unitState,
    unitStats: {
      ...buildUnitStatsMap(config.faction, upgradedSet),
      ...unitStats,
    },
    hitPools: [],
  }
}

function buildAbilitiesConfig(
  attacker: SideConfig,
  defender: SideConfig,
): AbilitiesConfig {
  const buildSideConfig = (
    config: SideConfig,
  ): Record<string, Record<string, unknown>> => {
    const result: Record<string, Record<string, unknown>> = {}
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

  return {
    attacker: buildSideConfig(attacker),
    defender: buildSideConfig(defender),
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function buildCombatState(config: CombatStateConfig): CombatState {
  const attackerSide = buildSideState(config.attacker)
  const defenderSide = buildSideState(config.defender)
  const abilitiesConfig = buildAbilitiesConfig(config.attacker, config.defender)

  return CombatState.forSimulation(
    attackerSide,
    defenderSide,
    config.mode,
    abilitiesConfig,
  )
}
