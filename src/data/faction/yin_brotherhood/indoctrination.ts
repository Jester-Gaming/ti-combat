import type { Ability } from '@/combat/abilities/types'

type Params = {
  isEnabled: boolean
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
    deployMech: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        if (!params.isEnabled) return false
        return ctx.api.opponent.hasUnit('INFANTRY')
      },
      call: (ctx, params) => {
        ctx.api.opponent.removeUnit('INFANTRY')
        const unit = params.deployMech ? 'MECH' : 'INFANTRY'
        ctx.api.own.addUnit({ [unit]: 1 })
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
