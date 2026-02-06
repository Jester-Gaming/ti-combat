import type { Ability } from '../../../combat/abilities/types'

type Params = {
  supportCount: number
}

export const imperator: Ability<Params> = {
  key: 'IMPERATOR',
  name: 'Imperator',
  category: 'FACTION',
  subcategory: 'BREAKTHROUGH',
  params: {
    isEnabled: true,
    uses: Infinity,
    supportCount: 0,
  },
  headerUI: 'supportCount',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params, _ctx, dice) => {
        return params.supportCount > 0 && !dice.own.isEmpty()
      },
      call: (_ctx, params, dice) => {
        dice.own.modifyHitValue(-params.supportCount)
      },
    },
  ],
}
