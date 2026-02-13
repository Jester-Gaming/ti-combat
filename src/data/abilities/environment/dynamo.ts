import type { Unit } from '@/types'

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
      isCallable: (_params, ctx, unit: Unit) => {
        const allUnits = ctx.api.own.getUnits()
        return Object.values(allUnits).some(units =>
          units?.some(u => u === unit),
        )
      },
      call: (ctx, _params, unit: Unit) => {
        ctx.api.own.modifyUnit(unit, { isDamaged: false })
      },
    },
  ],
}
