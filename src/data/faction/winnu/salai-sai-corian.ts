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

        // Set dice count to number of non-fighter ships
        const currentDice = dice.own.get(ctx.getUnitType())?.[
          ctx.getUnitIndex()
        ]
        const currentCount = currentDice?.[1] ?? 0
        const delta = nonFighterCount - currentCount
        if (delta !== 0) {
          dice.own.addDiceCount(delta, ctx.getUnit())
        }
      },
    },
  ],
}
