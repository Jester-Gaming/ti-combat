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
      call: (ctx, params) => {
        if (params.excludeUnits.length === 0) {
          ctx.api.own.modifyHitValue(1)
        } else {
          ctx.api.own.modifyHitValue(1, { exclude: params.excludeUnits })
        }
      },
    },
  ],
}
