import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, parseVariantId } from '@/combat'
import {
  declareGalvanizeUnits,
  GALVANIZED,
  galvanizeUnit,
} from '@/data/abilities/general/pre-galvanized'
import type { UnitType } from '@/types'

export const a3Valiance: Ability = {
  key: 'A3_VALIANCE',
  name: 'A3 Valiance',
  description:
    'When this unit is destroyed, if it was galvanized, galvanize up to 3 of your infantry in its system.',
  icon: lastBastionIcon,
  category: 'FACTION',
  subcategory: 'MECH',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareParamChange: () => [declareGalvanizeUnits('INFANTRY')],
  invoke: [
    {
      timing: 'WHEN_DESTROY',
      isCallable: (_params, ctx, units) => {
        const myId = ctx.getUnit()
        for (const key in units.own) {
          const { type, subtypes } = parseVariantId(key as UnitType)
          if (type !== 'MECH' || !subtypes.includes(GALVANIZED)) continue
          if (units.own[key as UnitType]?.includes(myId)) {
            if (!ctx.api.own.hasUnitType('INFANTRY')) return false
            const tokens =
              ctx.api.own.getAbilityConfig('PRE_GALVANIZED')
                ?.reinforcementTokens ?? 0
            return tokens > 0
          }
        }
        return false
      },
      call: ctx => {
        for (let i = 0; i < 3; i++) {
          if (!ctx.api.own.hasUnitType('INFANTRY')) break
          if (!galvanizeUnit(ctx, 'INFANTRY', true)) break
        }
      },
    },
  ],
}
