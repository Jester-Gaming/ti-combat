import factions from '@/data/faction'
import type { CombatSide, Faction, FactionKey } from '@/types'

import actionCard from '../../data/abilities/action-card'
import agenda from '../../data/abilities/agenda'
import environment from '../../data/abilities/environment'
import general from '../../data/abilities/general'
import technology from '../../data/abilities/technology'
import type { Ability } from './types'

// Collect all promissory abilities from every faction (available to all)
const allPromissoryAbilities = Object.values(factions).flatMap(
  faction => faction?.abilities?.promissory ?? [],
) as Ability[]

// Collect all agent abilities from every faction (available to all)
const allAgentAbilities = Object.values(factions).flatMap(
  faction => faction?.abilities?.agent ?? [],
) as Ability[]

// Collect all commander abilities from every faction (available to all)
const allCommanderAbilities = Object.values(factions).flatMap(
  faction => faction?.abilities?.commander ?? [],
) as Ability[]

const allAbilities = [
  ...general,
  ...environment,
  ...agenda,
  ...technology,
  ...actionCard,
  ...allPromissoryAbilities,
  ...allAgentAbilities,
  ...allCommanderAbilities,
]

/** Collect abilities with UI from faction unit definitions */
function collectUnitAbilities(faction: Faction): Ability[] {
  const seen = new Set<string>()
  const abilities: Ability[] = []

  for (const unitDef of Object.values(faction.units)) {
    if (!unitDef) continue

    const allUnitAbilities = [
      ...(unitDef.BASE.ABILITIES ?? []),
      ...(unitDef.UPGRADED?.ABILITIES ?? []),
    ]

    for (const ability of allUnitAbilities) {
      if (seen.has(ability.key)) continue
      if (!ability.headerUI && !ability.uiConfig) continue
      seen.add(ability.key)
      abilities.push(ability)
    }
  }

  return abilities
}

/** Get keys of all abilities defined on faction units (regardless of unit state) */
export function getUnitDefinitionAbilityKeys(
  factionKey: FactionKey,
): Set<string> {
  const faction = factions[factionKey]
  if (!faction) return new Set()
  const keys = new Set<string>()
  for (const unitDef of Object.values(faction.units)) {
    if (!unitDef) continue
    for (const ability of [
      ...(unitDef.BASE.ABILITIES ?? []),
      ...(unitDef.UPGRADED?.ABILITIES ?? []),
    ]) {
      keys.add(ability.key)
    }
  }
  return keys
}

export function getAvailableAbilities(
  side: CombatSide,
  factionKey: FactionKey,
): Ability[] {
  const baseAbilities = allAbilities.filter(ability => {
    if (!ability.condition) return true
    if (ability.condition.onlyAttacker && side !== 'attacker') return false
    if (ability.condition.onlyDefender && side !== 'defender') return false
    return true
  })

  // Get faction-specific abilities
  const faction = factions[factionKey]
  const abilities = faction?.abilities
  const factionAbilities = [
    ...(abilities?.faction ?? []),
    ...(abilities?.technology ?? []),
    ...(abilities?.hero ?? []),
    ...(abilities?.breakthrough ?? []),
  ]
  const unitAbilities = faction ? collectUnitAbilities(faction) : []

  return [...baseAbilities, ...factionAbilities, ...unitAbilities]
}
