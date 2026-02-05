import { NON_FIGHTER_SHIPS } from '@/constants/units'

import type {
  Ability,
  AbilityCallContext,
  DiceContext,
} from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const blitz: Ability<Params> = {
  key: 'BLITZ',
  name: 'Blitz',
  category: 'ACTION_CARD',
  context: 'GROUND',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  condition: { onlyAttacker: true },
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'BOMBARDMENT',
      isCallable: (params: Params) => params.isEnabled,
      call: (ctx: AbilityCallContext, _params: Params, dice: DiceContext) => {
        for (const unitType of NON_FIGHTER_SHIPS) {
          const units = ctx.api.own.getUnits(unitType)
          for (const unit of units) {
            if (!unit.UNIT_ABILITIES?.BOMBARDMENT) {
              dice.own.addDiceGroup(unitType, unit, [6, 1])
            }
          }
        }
      },
    },
  ],
}
