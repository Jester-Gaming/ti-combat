import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'

import type { Ability } from '../../../combat/abilities-engine/types'

export const tekklarLegion: Ability = {
  key: 'TEKKLAR_LEGION',
  name: 'Tekklar Legion',
  icon: sardakkNorrIcon,
  category: 'PROMISSORY',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'GROUND_COMBAT',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1)
        if (ctx.api.opponent.getFaction() === 'SARDAKK_NORR') {
          ctx.api.opponent.modifyHitValue(1)
        }
      },
    },
  ],
}
