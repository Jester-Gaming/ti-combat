import winnuIcon from '@/assets/faction/winnu.svg?raw'

import type { Ability } from '../../../combat/abilities-engine/types'

export const rickarRickani: Ability = {
  key: 'RICKAR_RICKANI',
  name: 'Rickar Rickani',
  icon: winnuIcon,
  category: 'COMMANDER',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.modifyHitValue(-2)
      },
    },
  ],
}
