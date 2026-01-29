import factions from '@/data/faction'
import type { FactionKey } from '@/types'

import type { CombatSide } from '../state/types'
import agenda from './list/agenda'
import environment from './list/environment'
import general from './list/general'
import technology from './list/technology'
import type { Ability } from './types'

export {
  getAbilityParams,
  hasAbility,
  runAbilities,
  type RunAbilitiesResult,
} from './abilities-tracker'
export type {
  Ability,
  AbilityCallContext,
  AbilityCondition,
  AbilityInstance,
  AbilityInvoke,
  AbilityReadContext,
  AbilityTiming,
  DiceApi,
  DiceContext,
  DiceReadApi,
  DiceReadContext,
  OwnOpponentContext,
  SideAbilities,
  SideApi,
  SidedContext,
  SidedDiceData,
  SideReadApi,
} from './types'

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
  ...allPromissoryAbilities,
  ...allAgentAbilities,
  ...allCommanderAbilities,
]

export function getAvailableAbilities(
  side: CombatSide,
  factionKey: FactionKey,
): Ability[] {
  const baseAbilities = allAbilities.filter(ability => {
    if (!ability.condition) return true
    if (ability.condition.onlyDefender && side !== 'defender') return false
    return true
  })

  // Get faction-specific abilities
  const faction = factions[factionKey]
  const factionAbilities = faction?.abilities?.faction ?? []

  return [...baseAbilities, ...factionAbilities]
}
