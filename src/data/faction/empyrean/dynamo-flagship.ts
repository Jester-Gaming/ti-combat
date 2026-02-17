import type { Ability } from '@/combat/abilities/types'
import type { Unit } from '@/types'

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
    {
      timing: 'DESTROY',
      always: true,
      isCallable: params => params.isEnabled !== false,
      call: ctx => {
        ctx.api.own.updateAbilityConfig('DYNAMO', { uses: 0 })
      },
    },
  ],
}
