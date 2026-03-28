import factions from '@/data/faction'
import type { CombatSide, Faction, FactionKey, UnitBaseType } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import type { Ability } from '../../combat/abilities-engine/types'
import actionCard from '../../data/abilities/action-card'
import agenda from '../../data/abilities/agenda'
import environment from '../../data/abilities/environment'
import general from '../../data/abilities/general'
import relic from '../../data/abilities/relic'
import technology from '../../data/abilities/technology'

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

// Collect allowExternal abilities from all factions (available to all)
const allExternalAbilities: Ability[] = []
{
  const seen = new Set<string>()
  const addIfExternal = (ability: Ability) => {
    if (!ability.allowExternal) return
    if (seen.has(ability.key)) return
    if (!ability.headerUI && !ability.uiConfig) return
    seen.add(ability.key)
    allExternalAbilities.push(ability)
  }
  for (const faction of Object.values(factions)) {
    if (!faction) continue
    for (const unitDef of Object.values(faction.units)) {
      if (!unitDef) continue
      for (const ability of [
        ...(unitDef.BASE.ABILITIES ?? []),
        ...(unitDef.UPGRADED?.ABILITIES ?? []),
      ]) {
        addIfExternal(ability)
      }
    }
    if (faction.abilities) {
      for (const list of Object.values(faction.abilities)) {
        if (list) {
          for (const ability of list) addIfExternal(ability as Ability)
        }
      }
    }
  }
}

const allAbilities = [
  ...general,
  ...environment,
  ...agenda,
  ...technology,
  ...actionCard,
  ...relic,
  ...allPromissoryAbilities,
  ...allAgentAbilities,
  ...allCommanderAbilities,
  ...allExternalAbilities,
]

const NEUTRAL_HIDDEN_CATEGORIES = new Set([
  'AGENDA',
  'TECHNOLOGY',
  'ACTION_CARD',
  'COMMANDER',
  'RELIC',
  'PROMISSORY',
])

/** Collect abilities with UI from faction unit definitions */
function collectUnitAbilities(
  faction: Faction,
  upgradedTypes?: ReadonlySet<UnitBaseType>,
): Ability[] {
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
      if (ability.allowExternal) continue // in global pool already
      seen.add(ability.key)
      abilities.push(ability)
    }
  }

  // Collect DEPLOY from effective stats only
  for (const [unitType, unitDef] of Object.entries(faction.units)) {
    if (!unitDef) continue
    const effective = getEffectiveStats(
      unitDef.BASE,
      unitDef.UPGRADED,
      upgradedTypes?.has(unitType as UnitBaseType) ?? false,
    )
    const deploy = effective.UNIT_ABILITIES?.DEPLOY
    if (deploy && !seen.has(deploy.key)) {
      if (deploy.headerUI || deploy.uiConfig) {
        seen.add(deploy.key)
        abilities.push(deploy)
      }
    }
  }

  return abilities
}

const unitDefAbilityKeysCache = new Map<FactionKey, ReadonlySet<string>>()

/** Get keys of all abilities defined on faction units (regardless of unit state) */
export function getUnitDefinitionAbilityKeys(
  factionKey: FactionKey,
): ReadonlySet<string> {
  const cached = unitDefAbilityKeysCache.get(factionKey)
  if (cached) return cached
  const keys = new Set<string>()
  const faction = factions[factionKey]
  if (!faction) return keys
  for (const unitDef of Object.values(faction.units)) {
    if (!unitDef) continue
    for (const ability of [
      ...(unitDef.BASE.ABILITIES ?? []),
      ...(unitDef.UPGRADED?.ABILITIES ?? []),
    ]) {
      keys.add(ability.key)
    }
    for (const stats of [unitDef.BASE, unitDef.UPGRADED]) {
      const deploy = stats?.UNIT_ABILITIES?.DEPLOY
      if (deploy) keys.add(deploy.key)
    }
  }
  unitDefAbilityKeysCache.set(factionKey, keys)
  return keys
}

const factionOwnedKeysCache = new Map<FactionKey, ReadonlySet<string>>()

/** Get keys of all faction-owned abilities (unit definitions + faction abilities) */
export function getFactionOwnedAbilityKeys(
  factionKey: FactionKey,
): ReadonlySet<string> {
  const cached = factionOwnedKeysCache.get(factionKey)
  if (cached) return cached
  const keys = new Set(getUnitDefinitionAbilityKeys(factionKey))
  const faction = factions[factionKey]
  if (faction?.abilities) {
    const a = faction.abilities
    for (const list of Object.values(a)) {
      if (list) {
        for (const ability of list) keys.add((ability as Ability).key)
      }
    }
  }
  factionOwnedKeysCache.set(factionKey, keys)
  return keys
}

export function getAvailableAbilities(
  side: CombatSide,
  factionKey: FactionKey,
  upgradedTypes?: ReadonlySet<UnitBaseType>,
): Ability[] {
  const isNeutral = factionKey === 'NEUTRAL'

  const ownedKeys = getFactionOwnedAbilityKeys(factionKey)
  const baseAbilities = allAbilities
    .filter(ability => {
      if (ability.side && ability.side !== side) return false
      if (isNeutral && NEUTRAL_HIDDEN_CATEGORIES.has(ability.category))
        return false
      return true
    })
    .map(ability => {
      if (ability.allowExternal && !ownedKeys.has(ability.key)) {
        return { ...ability, category: 'OTHER' }
      }
      return ability
    })

  // Get faction-specific abilities
  const faction = factions[factionKey]
  const abilities = faction?.abilities
  const factionAbilities = [
    ...(abilities?.faction ?? []),
    ...(abilities?.technology ?? []),
    ...(abilities?.unit ?? []),
    ...(abilities?.hero ?? []),
    ...(abilities?.breakthrough ?? []),
  ]
  const unitAbilities = faction
    ? collectUnitAbilities(faction, upgradedTypes)
    : []

  return [...baseAbilities, ...factionAbilities, ...unitAbilities]
}
