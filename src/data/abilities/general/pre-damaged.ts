import type { UnitType } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  damagedUnits: Partial<Record<UnitType, number | undefined>>
}

export const preDamaged: Ability<Params> = {
  key: 'PRE_DAMAGED',
  name: 'Damaged Units',
  category: 'GENERAL',
  params: {
    isEnabled: true,
    uses: Infinity,
    damagedUnits: {},
  },
  uiConfig: ctx => {
    const items = ctx.api.own.getUnitVariantsOptions({
      exclude: ['FIGHTER'],
    })

    return items.length > 0
      ? [
          {
            key: 'damagedUnits',
            label: 'Damaged Units',
            type: 'number-list',
            items,
          },
        ]
      : []
  },
  invoke: [
    {
      timing: 'PREPARE',
      call: (ctx, params) => {
        for (const [unitType, count] of Object.entries(params.damagedUnits)) {
          const ids = ctx.api.own.getUnits(unitType as UnitType)
          const max = Math.min(count ?? 0, ids.length)
          for (let i = 0; i < max; i++) {
            ctx.api.own.modifyUnitState(ids[i], { isDamaged: true })
          }
        }
      },
    },
  ],
}
