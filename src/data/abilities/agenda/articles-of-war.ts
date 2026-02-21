import type { Ability, SideApi } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

function stripMechAbilities(api: SideApi) {
  // Remove unit abilities (except Sustain Damage) from mechs
  api.setUnitAbilityLost('BOMBARDMENT', 'ARTICLES_OF_WAR', 'MECH')
  api.setUnitAbilityLost('AFB', 'ARTICLES_OF_WAR', 'MECH')
  api.setUnitAbilityLost('SPACE_CANNON', 'ARTICLES_OF_WAR', 'MECH')
  api.setUnitAbilityLost('PLANETARY_SHIELD', 'ARTICLES_OF_WAR', 'MECH')

  // Remove printed Ability objects from mech units (keep only Sustain Damage)
  const mechStats = api.getUnitStats('MECH')
  if (mechStats?.ABILITIES) {
    api.modifyUnitType('MECH', {
      ABILITIES: mechStats.ABILITIES.filter(a => a.key === 'SUSTAIN_DAMAGE'),
    })
  }
}

export const articlesOfWar: Ability<Params> = {
  key: 'ARTICLES_OF_WAR',
  name: 'Articles of War',
  category: 'AGENDA',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        stripMechAbilities(ctx.api.own)
        stripMechAbilities(ctx.api.opponent)
      },
    },
  ],
}
