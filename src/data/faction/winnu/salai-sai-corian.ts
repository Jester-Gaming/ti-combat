import type { Ability } from '../../../combat/abilities/types'

export const salaiSaiCorian: Ability = {
  key: 'SALAI_SAI_CORIAN',
  name: 'Salai Sai Corian',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      call: (ctx, _params, dice) => {
        // Count opponent's non-fighter ships
        let nonFighterCount = 0
        for (const type of ctx.api.opponent.getParticipatingUnitTypes()) {
          if (type === 'FIGHTER') continue
          nonFighterCount += ctx.api.opponent.getUnits(type).length
        }

        // Flagship has COMBAT: [7, 1] as base — adjust to non-fighter count
        dice.own.addDiceCount(nonFighterCount - 1, ctx.getUnit())
      },
    },
  ],
}
