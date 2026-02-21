import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability } from '@/combat/abilities/types'
import { getUnitId } from '@/combat/utils/compact-units'
import { parseVariantId } from '@/combat/utils/unit-variant'

type Params = {
  targetPriority: string[]
}

export const raidFormation: Ability<Params> = {
  key: 'RAID_FORMATION',
  name: 'Raid Formation',
  category: 'FACTION',
  subcategory: 'ABILITY',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
    targetPriority: declareParam({
      default: [],
      source: 'nonFighterShips',
      side: 'opponent',
    }),
  },
  uiConfig: ctx => {
    return [
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'order-list' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
  invoke: [
    {
      timing: 'AFTER_UNIT_ABILITY_ROLL',
      context: 'AFB',
      isCallable: (_, ctx) => {
        const pendingHits = ctx.api.opponent.getPendingHits()
        const fighterCount = ctx.api.opponent.getUnits('FIGHTER').length

        return pendingHits > fighterCount
      },
      call: (ctx, params) => {
        const pendingHits = ctx.api.opponent.getPendingHits()
        const fighterCount = ctx.api.opponent.getUnits('FIGHTER').length
        const excess = pendingHits - fighterCount

        let damaged = 0

        for (let i = 0; i < excess; i++) {
          let found = false

          for (const variantId of params.targetPriority) {
            const { type: unitType } = parseVariantId(variantId)

            if (
              ctx.api.opponent.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType)
            ) {
              continue
            }

            const units = ctx.api.opponent.getUnits(unitType)
            const index = units.findIndex(
              unit => !unit.isDamaged && unit.UNIT_ABILITIES?.SUSTAIN_DAMAGE,
            )

            if (index >= 0) {
              ctx.api.opponent.modifyUnitState(getUnitId(units[index])!, {
                isDamaged: true,
              })
              damaged++
              found = true
              break
            }
          }

          if (!found) break
        }

        if (damaged > 0) {
          ctx.log(`Raid Formation: ${damaged} ship(s) damaged`)
        }
      },
    },
  ],
}
