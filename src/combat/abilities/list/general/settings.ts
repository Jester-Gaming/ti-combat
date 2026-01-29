import type { UnitType } from '@/types'

import type { Ability } from '../../types'

type Params = {
  spaceCombatParticipating: UnitType[]
  groundCombatParticipating: UnitType[]
  validTargetsSpaceCannonOffense: UnitType[]
  validTargetsBombardment: UnitType[]
  validTargetsSpaceCannonDefense: UnitType[]
  validTargetsAntiFighterBarrage: UnitType[]
}

export const settings: Ability<Params> = {
  key: 'SETTINGS',
  name: 'Settings',
  category: 'GENERAL',
  defaultParams: {
    spaceCombatParticipating: [
      'FLAGSHIP',
      'WAR_SUN',
      'DREADNOUGHT',
      'CARRIER',
      'CRUISER',
      'DESTROYER',
      'FIGHTER',
    ],
    groundCombatParticipating: ['MECH', 'INFANTRY'],
    validTargetsSpaceCannonOffense: [],
    validTargetsBombardment: ['INFANTRY', 'MECH'],
    validTargetsSpaceCannonDefense: [],
    validTargetsAntiFighterBarrage: ['FIGHTER'],
  },
  invoke: [],
}
