import type { Ability } from '@/combat/abilities/types'
import type { UnitType } from '@/types'

type Params = {
  isEnabled: boolean
}

export const helTitan: Ability<Params> = {
  key: 'HEL_TITAN',
  name: 'Hel-Titan',
  category: 'FACTION',
  context: 'GROUND',
  params: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareParamChange: () => [{ key: 'groundForces', value: 'PDS' }],
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitType[]) => [...current, 'PDS'],
        })
      },
    },
  ],
}
