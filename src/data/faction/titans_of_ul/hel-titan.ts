import type { Ability } from '@/combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const helTitan: Ability<Params> = {
  key: 'HEL_TITAN',
  name: 'Hel-Titan',
  category: 'FACTION',
  context: 'GROUND',
  defaultParams: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareParticipants: params => {
    if (!params.isEnabled) return []
    return [{ unitType: 'PDS', combatMode: 'GROUND' }]
  },
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundCombatParticipating: ['MECH', 'INFANTRY', 'PDS'],
        })
      },
    },
  ],
}
