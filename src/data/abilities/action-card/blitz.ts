import { NON_FIGHTER_SHIPS } from '@/constants/units'

import type { Ability } from '../../../combat/abilities/types'

export const blitz: Ability = {
  key: 'BLITZ',
  name: 'Blitz',
  category: 'ACTION_CARD',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  side: 'attacker',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'BOMBARDMENT',
      call: (ctx, _params, dice) => {
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
