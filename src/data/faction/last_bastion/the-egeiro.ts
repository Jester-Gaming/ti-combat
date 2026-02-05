import type {
  Ability,
  DiceContext,
  DiceReadContext,
} from '../../../combat/abilities/types'

type Params = {
  nonHomeSystems: number
}

export const theEgeiro: Ability<Params> = {
  key: 'THE_EGEIRO',
  name: '(Bastion) The Egeiro',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'SPACE',
  params: {
    nonHomeSystems: 0,
  },
  headerUI: 'nonHomeSystems',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params, _ctx, dice: DiceReadContext) => {
        return params.nonHomeSystems > 0 && !dice.own.isEmpty()
      },
      call: (_ctx, params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-params.nonHomeSystems, 'FLAGSHIP')
      },
    },
  ],
}
