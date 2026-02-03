import type {
  Ability,
  AbilityCallContext,
  DiceContext,
} from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const tekklarLegion: Ability<Params> = {
  key: 'TEKKLAR_LEGION',
  name: "(N'orr) Tekklar Legion",
  category: 'PROMISSORY',
  context: 'GROUND',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'GROUND_COMBAT',
      isCallable: (params: Params) => {
        return params.isEnabled
      },
      call: (ctx: AbilityCallContext, _params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-1)
        if (ctx.api.opponent.getFaction() === 'SARDAKK_NORR') {
          dice.opponent.modifyHitValue(1)
        }
      },
    },
  ],
}
