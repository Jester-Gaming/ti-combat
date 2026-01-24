export {
  AbilitiesTracker,
  type AbilitiesTrackerOptions,
} from './abilities-tracker'
import type { CombatSideState } from '../state'
import agenda from './agenda'
import environment from './environment'
import general from './general'
export { nonEuclideanShielding } from './non-euclidean-shielding'
export type {
  Ability,
  AbilityContext,
  AbilityInstance,
  AbilityInvoke,
  AbilityTiming,
  AnyAbility,
  DiceData,
  SideAbilities,
  UIConfigCheckboxList,
  UIConfigItem,
  UIConfigListItem,
  UIConfigOrderList,
} from './types'
export { getMyDice, getOpponentDice, setMyDice } from './types'

export const allAbilities = [...general, ...environment, ...agenda]

export function getAvailableAbilities(side: CombatSideState) {
  console.log(side)
  return allAbilities
}
