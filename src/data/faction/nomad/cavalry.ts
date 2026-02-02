import { getVariantDisplayName } from '@/combat/utils/unit-variant'
import type { UnitType } from '@/types'

import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities/types'

const NOMAD_FLAGSHIP_COMBAT: [number, number] = [7, 2]
const NOMAD_FLAGSHIP_UNIT_ABILITIES = {
  SUSTAIN_DAMAGE: true as const,
  AFB: [8, 3] as [number, number],
}

type Params = {
  isEnabled: boolean
  unitType: UnitType
}

export const cavalry: Ability<Params> = {
  key: 'CAVALRY',
  name: '(Nomad) Cavalry',
  category: 'PROMISSORY',
  context: 'SPACE',
  defaultParams: {
    isEnabled: false,
    unitType: 'DESTROYER',
  },
  headerUI: 'isEnabled',
  declareSubtypes: params => {
    if (!params.isEnabled) return []
    return [{ name: 'Cavalry', unitType: params.unitType }]
  },
  uiConfig: (ctx: AbilityReadContext) => {
    const variants = ctx.api.own.getParticipatingVariants({
      exclude: ['FIGHTER'],
      excludeSubtypes: ['Cavalry'],
      combatMode: 'SPACE',
    })

    return [
      {
        key: 'unitType' as const,
        label: 'Unit Type',
        type: 'select' as const,
        items: variants.reverse().map(id => ({
          label: getVariantDisplayName(id),
          value: id,
        })),
      },
    ]
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params: Params, ctx: AbilityReadContext) => {
        return params.isEnabled && ctx.api.own.hasUnit(params.unitType)
      },
      call: (ctx, params: Params) => {
        ctx.api.own.addSubtype(params.unitType, 0, 'Cavalry')
        ctx.api.own.modifyUnit(params.unitType, 0, {
          COMBAT: NOMAD_FLAGSHIP_COMBAT,
          UNIT_ABILITIES: NOMAD_FLAGSHIP_UNIT_ABILITIES,
        })
      },
    },
  ],
}
