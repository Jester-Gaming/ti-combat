import type {
  Ability,
  DiceContext,
  DiceReadContext,
} from '../../../combat/abilities/types'

type Params = {
  supportCount: number
}

export const imperator: Ability<Params> = {
  key: 'IMPERATOR',
  name: 'Breakthrough',
  category: 'FACTION',
  defaultParams: {
    supportCount: 0,
  },
  headerUI: 'supportCount',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params, _ctx, dice: DiceReadContext) => {
        return params.supportCount > 0 && !dice.own.isEmpty()
      },
      call: (_ctx, params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-params.supportCount)
      },
    },
  ],
}
