export {
  AbilitiesTracker,
  type AbilitiesTrackerOptions,
} from './abilities-tracker'
import type { CombatSideState } from '../state'
import { general } from './general'
export { nonEuclideanShielding } from './non-euclidean-shielding'
export type {
  Ability,
  AbilityContext,
  AbilityInstance,
  AbilityInvoke,
  AbilityTiming,
  AnyAbility,
  SideAbilities,
  UIConfigCheckboxList,
  UIConfigItem,
  UIConfigListItem,
  UIConfigOrderList,
} from './types'

export const allAbilities = [...general]

export function getAvailableAbilities(side: CombatSideState) {
  console.log(side)
  return allAbilities
}
