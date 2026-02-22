import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

export const helTitan: Ability = {
  key: 'HEL_TITAN',
  name: 'Hel-Titan',
  category: 'FACTION',
  subcategory: 'UNIT',

  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareParamChange: () => [{ key: 'groundForces', value: 'PDS' }],
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitBaseType[]) => [...current, 'PDS'],
        })
      },
    },
  ],
}
