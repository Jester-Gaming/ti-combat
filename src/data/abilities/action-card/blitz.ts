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
      timing: 'PREPARE',
      call: ctx => {
        for (const unitType of NON_FIGHTER_SHIPS) {
          const stats = ctx.api.own.getUnitStats(unitType)!
          const hasBombardment = stats.UNIT_ABILITIES?.BOMBARDMENT

          if (!hasBombardment) {
            ctx.api.own.modifyUnitType(unitType, {
              UNIT_ABILITIES: {
                BOMBARDMENT: [6, 1],
              },
            })
          }
        }
      },
    },
  ],
}
