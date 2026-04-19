import { UNIT_ABILITIES } from '@/constants/units'

import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  isEnabled: boolean
}

export const articlesOfWar: Ability<Params> = {
  key: 'ARTICLES_OF_WAR',
  name: 'Articles of War',
  description:
    'All mechs lose their printed abilities except for Sustain Damage.',
  category: 'AGENDA',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  sync: true,
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        for (const ability of UNIT_ABILITIES) {
          if (ability === 'SUSTAIN_DAMAGE') continue
          ctx.api.own.setUnitAbilityLost(ability, 'ARTICLES_OF_WAR', 'MECH')
        }

        // Remove printed Ability objects from mech units (keep only Sustain Damage)
        const mechStats = ctx.api.own.getUnitStats('MECH')
        if (mechStats?.ABILITIES) {
          ctx.api.own.modifyUnitType('MECH', {
            ABILITIES: mechStats.ABILITIES.filter(
              a => a.key === 'SUSTAIN_DAMAGE',
            ),
          })
        }
      },
    },
  ],
}
