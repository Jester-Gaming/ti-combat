import type { Ability } from '@/combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const matriarch: Ability<Params> = {
  key: 'MATRIARCH',
  name: 'Matriarch',
  category: 'FACTION',
  context: 'GROUND',
  defaultParams: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  declareParticipants: params => {
    if (!params.isEnabled) return []
    return [{ unitType: 'FIGHTER', combatMode: 'GROUND' }]
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundCombatParticipating: ['FIGHTER', 'MECH', 'INFANTRY'],
        })
      },
    },
  ],
}
