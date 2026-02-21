import {
  GROUND_FORCES,
  NON_FIGHTER_SHIPS,
  SHIPS,
  STRUCTURES,
} from '@/constants/units'
import type { UnitBaseType } from '@/types'

import { declareParam } from '../../../combat/abilities/declare-param'
import type { Ability, DeclaredSubtype } from '../../../combat/abilities/types'

type Params = {
  nonFighterShips: UnitBaseType[]
  ships: UnitBaseType[]
  groundForces: UnitBaseType[]
  structures: UnitBaseType[]
  spaceCombatParticipating: UnitBaseType[]
  groundCombatParticipating: UnitBaseType[]
  validTargetsSpaceCannonOffense: UnitBaseType[]
  validTargetsBombardment: UnitBaseType[]
  validTargetsSpaceCannonDefense: UnitBaseType[]
  validTargetsAntiFighterBarrage: UnitBaseType[]
  subtypes: DeclaredSubtype[]
}

export const settings: Ability<Params> = {
  key: 'SETTINGS',
  name: 'Settings',
  category: 'GENERAL',
  params: {
    isEnabled: true,
    uses: Infinity,
    ships: SHIPS,
    nonFighterShips: declareParam({
      default: NON_FIGHTER_SHIPS,
      source: 'ships',
      compute: (ships: UnitBaseType[]) => ships.filter(u => u !== 'FIGHTER'),
    }),
    groundForces: GROUND_FORCES,
    structures: STRUCTURES,
    spaceCombatParticipating: declareParam({
      default: [],
      source: 'ships',
    }),
    groundCombatParticipating: declareParam({
      default: [],
      source: 'groundForces',
    }),
    validTargetsSpaceCannonOffense: [
      'FLAGSHIP',
      'WAR_SUN',
      'DREADNOUGHT',
      'CARRIER',
      'CRUISER',
      'DESTROYER',
      'FIGHTER',
    ],
    validTargetsBombardment: declareParam({
      default: [],
      source: 'groundForces',
    }),
    validTargetsSpaceCannonDefense: declareParam({
      default: [],
      source: 'groundForces',
    }),
    validTargetsAntiFighterBarrage: ['FIGHTER'],
    subtypes: [],
  },
  invoke: [],
}
