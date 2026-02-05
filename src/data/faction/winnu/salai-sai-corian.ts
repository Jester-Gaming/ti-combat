import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const salaiSaiCorian: Ability<Params> = {
  key: 'SALAI_SAI_CORIAN',
  name: 'Salai Sai Corian',
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
      context: 'SPACE_COMBAT',
      call: (ctx, _params: Params, dice: DiceContext) => {
        // Count opponent's non-fighter ships
        let nonFighterCount = 0
        for (const type of ctx.api.opponent.getParticipatingUnitTypes()) {
          if (type === 'FIGHTER') continue
          nonFighterCount += ctx.api.opponent.getUnits(type).length
        }

        // Flagship has COMBAT: [7, 1] as base — adjust to non-fighter count
        dice.own.addDice(nonFighterCount - 1, ctx.getUnit())
      },
    },
  ],
}
