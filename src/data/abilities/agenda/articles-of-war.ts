import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  isEnabled: boolean
}

export const articlesOfWar: Ability<Params> = {
  key: 'ARTICLES_OF_WAR',
  name: 'Articles of War',
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
        ctx.api.own.setUnitAbilityLost('BOMBARDMENT', 'ARTICLES_OF_WAR', 'MECH')
        ctx.api.own.setUnitAbilityLost('AFB', 'ARTICLES_OF_WAR', 'MECH')
        ctx.api.own.setUnitAbilityLost(
          'SPACE_CANNON',
          'ARTICLES_OF_WAR',
          'MECH',
        )
        ctx.api.own.setUnitAbilityLost(
          'PLANETARY_SHIELD',
          'ARTICLES_OF_WAR',
          'MECH',
        )

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
