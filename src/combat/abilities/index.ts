import factions from '@/data/faction'
import type { FactionKey } from '@/types'

import type { CombatSide } from '../state/types'
import agenda from './list/agenda'
import environment from './list/environment'
import general from './list/general'
import type { Ability } from './types'

export {
  getAbilityParams,
  hasAbility,
  runAbilities,
  type RunAbilitiesResult,
} from './abilities-tracker'
export { nonEuclideanShielding } from './non-euclidean-shielding'
export type {
  Ability,
  AbilityCondition,
  AbilityContext,
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

export const allAbilities = [...general, ...environment, ...agenda]

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
