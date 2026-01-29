import type { Ability, DiceContext } from '../../../combat/abilities/types'

export const sardakkFlagshipAbility: Ability = {
  key: 'SARDAKK_FLAGSHIP',
  name: "C'morran N'orr",
  category: 'FACTION',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (_ctx, _params: Record<string, never>, dice: DiceContext) => {
        dice.own.modifyHitValue(-1, source => source !== 'FLAGSHIP')
      },
    },
  ],
}
