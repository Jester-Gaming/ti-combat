import type { Ability, AbilityReadContext } from '@/combat/abilities/types'
import type { UnitType } from '@/types'

type Params = {
  isEnabled: boolean
}

export const matriarch: Ability<Params> = {
  key: 'MATRIARCH',
  name: 'Matriarch',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'GROUND',
  params: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  declareParamChange: () => [{ key: 'groundForces', value: 'FIGHTER' }],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params: Params, ctx: AbilityReadContext) =>
        params.isEnabled && ctx.api.own.hasUnit('FLAGSHIP'),
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitType[]) => [...current, 'FIGHTER'],
        })
      },
    },
  ],
}
