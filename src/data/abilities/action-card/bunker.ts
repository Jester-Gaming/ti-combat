import type {
  Ability,
  DiceContext,
  DiceReadContext,
} from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const bunker: Ability<Params> = {
  key: 'BUNKER',
  name: 'Bunker',
  category: 'ACTION_CARD',
  context: 'GROUND',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  condition: { onlyDefender: true },
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'BOMBARDMENT',
      isCallable: (params: Params, _ctx, dice: DiceReadContext) => {
        return params.isEnabled && !dice.opponent.isEmpty()
      },
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.opponent.modifyHitValue(4)
      },
    },
  ],
}
