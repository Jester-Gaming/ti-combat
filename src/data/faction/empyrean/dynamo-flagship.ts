import type { Ability } from '@/combat/abilities/types'
import { parseVariantId } from '@/combat/utils/unit-variant'
import type { UnitLocator } from '@/types'

export const dynamoFlagship: Ability = {
  key: 'DYNAMO',
  name: 'Dynamo',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      side: 'OWN',
      isCallable: (_params, ctx, unit: UnitLocator) => {
        const { type } = parseVariantId(unit.key)
        return ctx.api.own.getUnits(type).length > 0
      },
      call: (ctx, _params, unit: UnitLocator) => {
        ctx.api.own.modifyUnit(unit, { isDamaged: false })
      },
    },
    {
      timing: 'DESTROY',
      isCallable: params => params.isEnabled !== false,
      call: ctx => {
        ctx.api.own.updateAbilityConfig('DYNAMO', { isEnabled: false })
      },
    },
  ],
}
