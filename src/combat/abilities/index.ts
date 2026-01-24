export {
  getAbilityParams,
  hasAbility,
  runAbilities,
  type RunAbilitiesResult,
} from './abilities-tracker'
import type { CombatSide } from '../state/types'
import agenda from './agenda'
import environment from './environment'
import general from './general'
import type { Ability } from './types'
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

export function getAvailableAbilities(side: CombatSide): Ability[] {
  return allAbilities.filter(ability => {
    if (!ability.condition) return true
    if (ability.condition.onlyDefender && side !== 'defender') return false
    return true
  })
}
