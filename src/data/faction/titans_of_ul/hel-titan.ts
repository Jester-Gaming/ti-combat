import type { Ability } from '@/combat/abilities/types'
import type { UnitType } from '@/types'

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
          groundForces: (current: UnitType[]) => [...current, 'PDS'],
        })
      },
    },
  ],
}
