import type { Ability } from '../../../combat/abilities-engine/types'

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
      call: ctx => {
        ctx.api.own.modifyUnitType('SPACE_DOCK', {
          UNIT_ABILITIES: { SPACE_CANNON: [5, 2] },
        })
      },
    },
  ],
}
