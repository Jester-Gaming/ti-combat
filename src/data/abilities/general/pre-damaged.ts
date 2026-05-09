import { z } from 'zod/mini'

import type { UnitList, UnitType } from '@/types'
import { UnitListNumberSchema } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  damagedUnits: UnitList<number>
}

export const preDamaged: Ability<Params> = {
  key: 'PRE_DAMAGED',
  name: 'Damaged Units',
  paramsSchema: z.object({
    damagedUnits: UnitListNumberSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    damagedUnits: [],
  },
  uiConfig: ctx => {
    const items = ctx.api.own.getUnitVariantsOptions({
      exclude: ['FIGHTER'],
    })

    return items.length > 0
      ? [
          {
            key: 'damagedUnits',
            type: 'unit-list',
            mode: 'number',
            items,
          },
        ]
      : []
  },
  invoke: [
    {
      timing: 'PREPARE',
      call: (ctx, params) => {
        for (const [unitType, count] of params.damagedUnits) {
          if (count <= 0) continue
          const ids = ctx.api.own.getUnits(unitType as UnitType, {
            includeVariants: false,
          })
          const max = Math.min(count, ids.length)
          for (let i = 0; i < max; i++) {
            ctx.api.own.modifyUnitState(ids[i], { isDamaged: true })
          }
        }
      },
    },
  ],
}
