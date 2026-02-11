import type { Ability } from '../../../combat/abilities/types'

export const assail: Ability = {
  key: 'ASSAIL',
  name: 'Assail',
  category: 'FACTION',
  subcategory: 'ABILITY',
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
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      isCallable: (_params, _ctx, dice) => {
        return !dice.own.isEmpty()
      },
      call: (_ctx, _params, dice) => {
        dice.own.modifyHitValue(-1)
      },
    },
  ],
}
