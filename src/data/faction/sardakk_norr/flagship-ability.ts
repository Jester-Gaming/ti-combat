import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const sardakkFlagshipAbility: Ability<Params> = {
  key: 'SARDAKK_FLAGSHIP',
  name: "C'morran N'orr",
  category: 'FACTION',
  subcategory: 'UNIT',
  params: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-1, source => source !== 'FLAGSHIP')
      },
    },
  ],
}
