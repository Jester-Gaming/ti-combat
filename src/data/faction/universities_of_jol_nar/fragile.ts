import type { UnitType } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
  uses: number
  excludeUnits: UnitType[]
}

export const fragile: Ability<Params> = {
  key: 'FRAGILE',
  name: 'Fragile',
  category: 'FACTION',
  subcategory: 'ABILITY',
  params: {
    isEnabled: true,
    uses: Infinity,
    excludeUnits: [],
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (_ctx, params, dice) => {
        if (params.excludeUnits.length === 0) {
          dice.own.modifyHitValue(1)
        } else {
          dice.own.modifyHitValue(
            1,
            unit => !params.excludeUnits.includes(unit),
          )
        }
      },
    },
  ],
}
