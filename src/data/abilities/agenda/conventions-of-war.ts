import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const conventionsOfWar: Ability<Params> = {
  key: 'CONVENTIONS_OF_WAR',
  name: 'Conventions of War',
  category: 'AGENDA',
  context: 'GROUND',
  params: {
    isEnabled: false,
  },
  condition: {
    onlyDefender: true,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          'CONVENTIONS_OF_WAR',
        )
      },
    },
  ],
}
