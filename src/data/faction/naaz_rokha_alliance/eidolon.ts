import type { Ability } from '@/combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const eidolon: Ability<Params> = {
  key: 'EIDOLON',
  name: 'Eidolon',
  category: 'FACTION',
  context: 'SPACE',
  defaultParams: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareParticipants: params => {
    if (!params.isEnabled) return []
    return [{ unitType: 'MECH', combatMode: 'SPACE' }]
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        // Add mech to space combat participation
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          spaceCombatParticipating: [
            'FLAGSHIP',
            'WAR_SUN',
            'DREADNOUGHT',
            'CARRIER',
            'CRUISER',
            'DESTROYER',
            'FIGHTER',
            'MECH',
          ],
        })

        // Z-Grav form loses Sustain Damage
        ctx.api.own.setUnitAbilityLost('SUSTAIN_DAMAGE', 'EIDOLON', 'MECH')

        // Modify all mechs to Z-Grav form: combat [8, 2]
        const mechs = ctx.api.own.getUnits('MECH')
        for (let i = 0; i < mechs.length; i++) {
          ctx.api.own.modifyUnit(mechs[i], { COMBAT: [8, 2] })
        }
      },
    },
  ],
}
