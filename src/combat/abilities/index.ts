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
  AbilityCondition,
  AbilityInstance,
  AbilityInvoke,
  AbilityReadContext,
  AbilityTiming,
  DiceData,
  OwnOpponentContext,
  SideAbilities,
  SidedContext,
  SidedDiceData,
  StateChange,
} from './types'

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
