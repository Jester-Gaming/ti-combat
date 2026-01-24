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
  DiceData,
  OwnOpponentContext,
  SideAbilities,
  SidedContext,
  SidedDiceData,
} from './types'

export const allAbilities = [...general, ...environment, ...agenda]

export function getAvailableAbilities(side: CombatSideState) {
  console.log(side)
  return allAbilities
}
