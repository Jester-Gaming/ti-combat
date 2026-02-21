import { parseVariantId } from '@/combat/utils/unit-variant'
import type { UnitLocator } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
  uses: number
}

export const dynamo: Ability<Params> = {
  key: 'DYNAMO',
  name: 'Dynamo',
  category: 'ENVIRONMENT',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      side: 'OWN',
      isCallable: (_params, ctx, unit: UnitLocator) => {
        const { type } = parseVariantId(unit.key)
        return ctx.api.own.getUnits(type).length > 0
      },
      call: (ctx, _params, unit: UnitLocator) => {
        ctx.api.own.modifyUnitState(unit, { isDamaged: false })
      },
    },
  ],
}
