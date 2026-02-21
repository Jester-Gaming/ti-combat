import { getUnitId } from '@/combat/utils/compact-units'
import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { UnitBaseType } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

type Params = {
  damagedUnits: Record<string, number>
}

export const preDamaged: Ability<Params> = {
  key: 'PRE_DAMAGED',
  name: 'Damaged Units',
  category: 'GENERAL',
  params: {
    isEnabled: true,
    uses: Infinity,
    damagedUnits: {},
  },
  uiConfig: ctx => {
    const settings = ctx.api.own.getAbilityConfig('SETTINGS')
    const nonFighterShips = (settings?.nonFighterShips ?? []) as UnitBaseType[]
    const groundForces = (settings?.groundForces ?? []) as UnitBaseType[]
    const items: { label: string; value: string; max: number }[] = []

    const unitTypes = [...new Set([...nonFighterShips, ...groundForces])]

    for (const type of unitTypes) {
      const unitAmount = ctx.api.own.countUnits(type)

      items.push({
        label: UNIT_DISPLAY_NAMES[type],
        value: type,
        max: unitAmount,
      })
    }

    return items.length > 0
      ? [
          {
            key: 'damagedUnits',
            label: 'Damaged Units',
            type: 'number-list',
            items,
          },
        ]
      : []
  },
  invoke: [
    {
      timing: 'PREPARE',
      call: (ctx, params) => {
        for (const [unitType, count] of Object.entries(params.damagedUnits)) {
          const units = ctx.api.own.getUnits(unitType as UnitBaseType)
          const max = Math.min(count, units.length)
          for (let i = 0; i < max; i++) {
            ctx.api.own.modifyUnitState(getUnitId(units[i])!, {
              isDamaged: true,
            })
          }
        }
      },
    },
  ],
}
