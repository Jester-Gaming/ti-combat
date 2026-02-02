import type { Ability } from '@/combat/abilities/types'
import { NON_FIGHTER_SHIPS } from '@/constants/units'

type Params = {
  isEnabled: boolean
}

export const theAlastor: Ability<Params> = {
  key: 'THE_ALASTOR',
  name: 'The Alastor',
  category: 'FACTION',
  context: 'SPACE',
  defaultParams: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  declareParticipants: params => {
    if (!params.isEnabled) return []
    return [
      { unitType: 'MECH', combatMode: 'SPACE' },
      { unitType: 'INFANTRY', combatMode: 'SPACE' },
    ]
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        // Add ground forces to space combat participation
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
            'INFANTRY',
          ],
        })

        // Add ground forces to the hit assignment sacrifice order
        ctx.api.own.updateAbilityConfig('UNIT_PRIORITY', {
          spaceUnitPriority: [
            'FIGHTER',
            'INFANTRY',
            'DESTROYER',
            'CRUISER',
            'CARRIER',
            'DREADNOUGHT',
            'MECH',
            'WAR_SUN',
            'FLAGSHIP',
          ],
        })

        // Allow mechs to sustain damage in space combat
        ctx.api.own.updateAbilityConfig('SUSTAIN_DAMAGE', {
          spaceUnits: [...NON_FIGHTER_SHIPS, 'MECH'],
          spaceUnitPriority: [...NON_FIGHTER_SHIPS.toReversed(), 'MECH'],
        })
      },
    },
  ],
}
