import type { Ability } from '../../../combat/abilities/types'

export const fighterPrototype: Ability = {
  key: 'FIGHTER_PROTOTYPE',
  name: 'Fighter Prototype',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      call: (_ctx, _params, dice) => {
        dice.own.modifyHitValue(-2, 'FIGHTER')
      },
    },
  ],
}
