import type { Ability } from '../../../combat/abilities/types'

export const unrelenting: Ability = {
  key: 'UNRELENTING',
  name: 'Unrelenting',
  category: 'FACTION',
  subcategory: 'ABILITY',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (_ctx, _params, dice) => {
        dice.own.modifyHitValue(-1)
      },
    },
  ],
}
