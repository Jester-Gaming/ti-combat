import type { DieValue } from '@/types'

import type { Ability, DiceData } from '../../../combat/abilities/types'

function applyFlagshipBonus(dice: DieValue[]): DieValue[] {
  return dice.map(([hitValue, count, source]) => {
    // Apply +1 to other ships (not the flagship itself)
    if (source !== 'FLAGSHIP') {
      return [Math.max(1, hitValue - 1), count, source]
    }
    return [hitValue, count, source]
  })
}

export const sardakkFlagshipAbility: Ability = {
  key: 'SARDAKK_FLAGSHIP',
  name: "C'morran N'orr",
  category: 'FACTION',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (_ctx, _params: Record<string, never>, diceData: DiceData) => {
        return {
          own: applyFlagshipBonus(diceData.own),
          opponent: diceData.opponent,
        }
      },
    },
  ],
}
