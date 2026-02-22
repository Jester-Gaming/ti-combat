import type { Ability } from '@/combat/abilities-engine/types'

type Params = {
  deployMech: boolean
}

export const indoctrination: Ability<Params> = {
  key: 'INDOCTRINATION',
  name: 'Indoctrination',
  category: 'FACTION',
  subcategory: 'ABILITY',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
    deployMech: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_params, ctx) => {
        return ctx.api.opponent.hasUnitType('INFANTRY')
      },
      call: (ctx, params) => {
        ctx.api.opponent.removeUnit('INFANTRY')
        const unit = params.deployMech ? 'MECH' : 'INFANTRY'
        ctx.api.own.placeUnits({ [unit]: 1 })
      },
    },
  ],
  uiConfig: () => [
    {
      key: 'deployMech' as const,
      label: 'Deploy Mech',
      type: 'checkbox' as const,
    },
  ],
}
