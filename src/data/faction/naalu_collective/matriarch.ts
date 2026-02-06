import type { Ability } from '@/combat/abilities/types'
import type { UnitType } from '@/types'

export const matriarch: Ability = {
  key: 'MATRIARCH',
  name: 'Matriarch',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  declareParamChange: () => [{ key: 'groundForces', value: 'FIGHTER' }],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_params, ctx) => ctx.api.own.hasUnit('FLAGSHIP'),
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitType[]) => [...current, 'FIGHTER'],
        })
      },
    },
  ],
}
