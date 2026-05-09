import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import { type Ability, parseVariantId } from '@/combat'
import {
  declareGalvanizeUnits,
  GALVANIZED,
  galvanizeUnit,
} from '@/data/abilities/general/pre-galvanized'

export const a3Valiance: Ability = {
  key: 'A3_VALIANCE',
  name: 'A3 Valiance',
  description:
    'When this unit is destroyed, if it was galvanized, galvanize up to 3 of your infantry in its system.',
  icon: lastBastionIcon,
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareSubtype: () => [declareGalvanizeUnits('INFANTRY', true)],
  invoke: [
    {
      timing: 'WHEN_DESTROY',
      isCallable: (_params, ctx, ids) => {
        const myId = ctx.getUnit()
        if (!ids.includes(myId)) return false
        const variantKey = ctx.api.own.getVariantKey(myId)
        if (!variantKey) return false
        const { type, subtypes } = parseVariantId(variantKey)
        if (type !== 'MECH' || !subtypes.includes(GALVANIZED)) return false
        if (!ctx.api.own.hasUnitType('INFANTRY')) return false
        const tokens =
          ctx.api.own.getAbilityConfig('PRE_GALVANIZED')?.reinforcementTokens ??
          0
        return tokens > 0
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
