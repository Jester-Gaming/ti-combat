import nomadIcon from '@/assets/faction/nomad.svg?raw'
import { type Ability, declareParam } from '@/combat'
import type { UnitType, UnitVariantId } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import { nomad } from './index'

type Params = {
  memoria2: boolean
  unitType: UnitType
}

const CAVALRY = 'Cavalry' as UnitVariantId

export const cavalry: Ability<Params> = {
  key: 'CAVALRY',
  name: 'Cavalry',
  icon: nomadIcon,
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
    { key: 'subtypes', value: { name: CAVALRY, unitType: params.unitType } },
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
          .getUnitVariantsOptions({
            exclude: ['FIGHTER'],
            excludeSubtypes: [CAVALRY],
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
        return ctx.api.own.hasUnitType(params.unitType)
      },
      call: (ctx, params) => {
        const flagship = nomad.units.FLAGSHIP!
        const memoriaStats = getEffectiveStats(
          flagship.BASE,
          flagship.UPGRADED,
          params.memoria2,
        )

        ctx.api.own.addSubtype(params.unitType, CAVALRY, stats => ({
          ...stats,
          COMBAT: [
            memoriaStats.COMBAT![0],
            memoriaStats.COMBAT![1],
            (memoriaStats.COMBAT![2] ?? 0) + (stats.COMBAT![2] ?? 0),
          ],
          UNIT_ABILITIES: {
            ...stats.UNIT_ABILITIES,
            SUSTAIN_DAMAGE: memoriaStats.UNIT_ABILITIES?.SUSTAIN_DAMAGE,
            AFB: memoriaStats.UNIT_ABILITIES?.AFB,
          },
        }))
      },
    },
  ],
}
