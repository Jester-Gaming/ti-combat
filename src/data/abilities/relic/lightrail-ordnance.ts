import type { Ability } from '../../../combat/abilities/types'

export const lightrailOrdnance: Ability = {
  key: 'LIGHTRAIL_ORDNANCE',
  name: 'Lightrail Ordnance',
  category: 'RELIC',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (_params, ctx) => ctx.api.own.hasUnit('SPACE_DOCK'),
      call: (ctx, _params, dice) => {
        const spaceDocks = ctx.api.own.getUnits('SPACE_DOCK')
        for (const dock of spaceDocks) {
          dice.own.addDiceGroup('SPACE_DOCK', dock, [5, 2])
        }
      },
    },
  ],
}
