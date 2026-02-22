import type { Ability } from '@/combat/abilities-engine/types'

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
      isCallable: () => true,
      call: (ctx, _params, unitId) => {
        ctx.api.own.modifyUnitState(unitId, { isDamaged: false })
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
