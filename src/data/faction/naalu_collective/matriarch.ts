import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

export const matriarch: Ability = {
  key: 'MATRIARCH',
  name: 'Matriarch',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  declareParamChange: () => [{ key: 'groundForces', value: 'FIGHTER' }],
  invoke: [
    {
      timing: 'COMMIT_UNITS',
      isCallable: (_params, ctx) => ctx.api.own.hasUnitType('FLAGSHIP'),
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitBaseType[]) => [...current, 'FIGHTER'],
        })
      },
    },
  ],
}
