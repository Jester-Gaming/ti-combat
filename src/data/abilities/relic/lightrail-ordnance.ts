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
      timing: 'PREPARE',
      isCallable: (_params, ctx) => ctx.api.own.hasUnit('SPACE_DOCK'),
      call: ctx => {
        ctx.api.own.modifyUnit('SPACE_DOCK', {
          UNIT_ABILITIES: { SPACE_CANNON: [5, 2] },
        })
      },
    },
  ],
}
