import type { Ability } from '../../../combat/abilities-engine/types'

export const sardakkFlagshipAbility: Ability = {
  key: 'SARDAKK_FLAGSHIP',
  name: "C'morran N'orr",
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
      call: ctx => {
        ctx.api.own.modifyHitValue(-1, { exclude: ['FLAGSHIP'] })
      },
    },
  ],
}
