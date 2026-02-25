import type { Ability } from '../../../combat/abilities-engine/types'

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
      isCallable: (_, ctx, unitId) => ctx.api.own.hasUnit(unitId),
      call: (ctx, _params, unitId) => {
        ctx.api.own.modifyUnitState(unitId, { isDamaged: false })
      },
    },
  ],
}
