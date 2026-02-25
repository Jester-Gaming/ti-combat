import {
  GROUND_FORCES,
  NON_FIGHTER_SHIPS,
  SHIPS,
  STRUCTURES,
} from '@/constants/units'
import type { UnitBaseType } from '@/types'

import type {
  Ability,
  SettingsParams,
} from '../../../combat/abilities-engine/types'

export const settings: Ability<SettingsParams> = {
  key: 'SETTINGS',
  name: 'Settings',
  category: 'GENERAL',
  params: {
    isEnabled: true,
    uses: Infinity,
    ships: SHIPS,
    nonFighterShips: NON_FIGHTER_SHIPS,
    groundForces: GROUND_FORCES,
    structures: STRUCTURES,
    spaceCombatParticipating: [],
    groundCombatParticipating: [],
    validTargetsSpaceCannonOffense: SHIPS,
    validTargetsBombardment: [],
    validTargetsSpaceCannonDefense: [],
    validTargetsAntiFighterBarrage: ['FIGHTER'],
    subtypes: [],
  },
  onParamSet(params, key) {
    if (key === 'ships') {
      params.nonFighterShips = (params.ships as UnitBaseType[]).filter(
        u => u !== 'FIGHTER',
      )
      params.spaceCombatParticipating = params.ships
      params.validTargetsSpaceCannonOffense = params.ships
    } else if (key === 'groundForces') {
      params.groundCombatParticipating = params.groundForces
      params.validTargetsBombardment = params.groundForces
      params.validTargetsSpaceCannonDefense = params.groundForces
    } else {
      return
    }
    return params
  },
  invoke: [],
}
