import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'

import type { Ability } from '../../../combat/abilities/types'

export const tekklarLegion: Ability = {
  key: 'TEKKLAR_LEGION',
  name: 'Tekklar Legion',
  icon: sardakkNorrIcon,
  category: 'PROMISSORY',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'GROUND_COMBAT',
      call: (ctx, _params, dice) => {
        dice.own.modifyHitValue(-1)
        if (ctx.api.opponent.getFaction() === 'SARDAKK_NORR') {
          dice.opponent.modifyHitValue(1)
        }
      },
    },
  ],
}
