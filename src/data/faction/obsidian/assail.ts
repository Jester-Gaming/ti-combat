import type {
  Ability,
  DiceContext,
  DiceReadContext,
} from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const assail: Ability<Params> = {
  key: 'ASSAIL',
  name: '(Obsidian) Assail',
  category: 'FACTION',
  subcategory: 'ABILITY',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params) => {
        return params.isEnabled
      },
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-1)
      },
    },
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      isCallable: (params: Params, _ctx, dice: DiceReadContext) => {
        return params.isEnabled && !dice.own.isEmpty()
      },
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-1)
      },
    },
  ],
}
