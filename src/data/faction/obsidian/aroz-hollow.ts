import obsidianIcon from '@/assets/faction/obsidian.svg?raw'

import type { Ability } from '../../../combat/abilities/types'

export const arozHollow: Ability = {
  key: 'AROZ_HOLLOW',
  name: 'Aroz Hollow',
  icon: obsidianIcon,
  category: 'COMMANDER',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (_ctx, _params, dice) => {
        dice.own.modifyHitValue(-1)
      },
    },
  ],
}
