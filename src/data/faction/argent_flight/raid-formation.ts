import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'

type Params = {
  targetPriority: UnitList
}

export const raidFormation: Ability<Params> = {
  key: 'RAID_FORMATION',
  name: 'Raid Formation',
  description:
    "When 1 or more of your units use Anti-Fighter Barrage, for each hit produced in excess of your opponent's fighters, choose 1 of your opponent's ships that has Sustain Damage to become damaged.",
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
    targetPriority: declareParam<UnitList>({
      default: [],
      source: 'nonFighterShips',
      side: 'opponent',
    }),
  },
  uiConfig: ctx => {
    return [
      {
        key: 'targetPriority' as const,
        type: 'unit-list' as const,
        mode: 'order' as const,
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
        const fighterCount = ctx.api.opponent.countUnits('FIGHTER')

        return pendingHits > fighterCount
      },
      call: (ctx, params) => {
        const pendingHits = ctx.api.opponent.getPendingHits()
        const fighterCount = ctx.api.opponent.countUnits('FIGHTER')
        const excess = pendingHits - fighterCount

        let damaged = 0

        for (let i = 0; i < excess; i++) {
          let found = false

          for (const variant of ctx.utils.getFlat(params.targetPriority)) {
            if (ctx.api.opponent.isUnitAbilityLost('SUSTAIN_DAMAGE', variant)) {
              continue
            }

            const units = ctx.api.opponent.getUnits(variant)
            const stats = ctx.api.opponent.getUnitStats(variant)

            if (!stats?.UNIT_ABILITIES?.SUSTAIN_DAMAGE) continue

            const unit = units.find(
              unit => !ctx.api.opponent.getUnitState(unit)?.isDamaged,
            )

            if (unit) {
              ctx.api.opponent.modifyUnitState(unit, {
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
          ctx.logger?.log(`${damaged} ship(s) damaged`)
        }
      },
    },
  ],
}
