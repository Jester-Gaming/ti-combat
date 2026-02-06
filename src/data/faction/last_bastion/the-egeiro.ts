import type { Ability } from '../../../combat/abilities/types'

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
    isEnabled: true,
    uses: Infinity,
    nonHomeSystems: 0,
  },
  headerUI: 'nonHomeSystems',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params, _ctx, dice) => {
        return params.nonHomeSystems > 0 && !dice.own.isEmpty()
      },
      call: (_ctx, params, dice) => {
        dice.own.modifyHitValue(-params.nonHomeSystems, 'FLAGSHIP')
      },
    },
  ],
}
