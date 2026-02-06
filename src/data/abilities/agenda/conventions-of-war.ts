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
  side: 'defender',
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          'CONVENTIONS_OF_WAR',
        )
      },
    },
  ],
}
