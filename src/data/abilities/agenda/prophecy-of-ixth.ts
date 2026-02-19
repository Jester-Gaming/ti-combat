import type { Ability } from '../../../combat/abilities/types'

export const prophecyOfIxth: Ability = {
  key: 'PROPHECY_OF_IXTH',
  name: 'Prophecy of Ixth',
  category: 'AGENDA',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1, 'FIGHTER')
      },
    },
  ],
}
