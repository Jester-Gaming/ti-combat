import type { Ability } from '../../../combat/abilities/types'

export const arozHollow: Ability = {
  key: 'AROZ_HOLLOW',
  name: '(Obsidian) Aroz Hollow',
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
