import type { Ability } from '../../../combat/abilities/types'

export const conventionsOfWar: Ability = {
  key: 'CONVENTIONS_OF_WAR',
  name: 'Conventions of War',
  category: 'AGENDA',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  sync: true,
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.setUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          'CONVENTIONS_OF_WAR',
        )
      },
    },
  ],
}
