import { declareParam } from '@/combat/abilities/declare-param'
import type { UnitType } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import type { Ability } from '../../../combat/abilities/types'
import { nomad } from './index'

type Params = {
  memoria2: boolean
  unitType: UnitType
}

export const cavalry: Ability<Params> = {
  key: 'CAVALRY',
  name: '(Nomad) Cavalry',
  category: 'PROMISSORY',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
    memoria2: false,
    unitType: declareParam<UnitType>({
      default: 'DESTROYER',
      source: 'nonFighterShips',
    }),
  },
  headerUI: 'isEnabled',
  declareParamChange: params => [
    { key: 'subtypes', value: { name: 'Cavalry', unitType: params.unitType } },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'memoria2' as const,
        label: 'Memoria II',
        type: 'checkbox' as const,
      },
      {
        key: 'unitType' as const,
        label: 'Unit Type',
        type: 'select' as const,
        items: ctx.api.own
          .getParticipatingVariantsOptions({
            exclude: ['FIGHTER'],
            excludeSubtypes: ['Cavalry'],
            combatMode: 'SPACE',
          })
          .reverse(),
      },
    ]
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        return ctx.api.own.hasUnit(params.unitType)
      },
      call: (ctx, params) => {
        const flagship = nomad.units.FLAGSHIP!
        const stats = getEffectiveStats(
          flagship.BASE,
          flagship.UPGRADED,
          params.memoria2,
        )

        ctx.api.own.addSubtype(params.unitType, 'Cavalry')
        ctx.api.own.modifyUnit(params.unitType, 0, {
          COMBAT: stats.COMBAT,
          UNIT_ABILITIES: stats.UNIT_ABILITIES,
          ...(stats.ABILITIES ? { ABILITIES: stats.ABILITIES } : {}),
        })
      },
    },
  ],
}
