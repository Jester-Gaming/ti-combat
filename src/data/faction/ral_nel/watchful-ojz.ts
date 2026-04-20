import ralNelIcon from '@/assets/faction/ral_nel.svg?raw'
import type { Ability } from '@/combat'
import type { UnitType } from '@/types'

import { retreatUnits } from '../../abilities/general/retreat'

type Params = {
  isEnabled: boolean
  shipConfig: Record<string, number>
}

export const watchfulOjz: Ability<Params> = {
  key: 'WATCHFUL_OJZ',
  name: 'Watchful Ojz',
  description:
    'When you declare a retreat: Immediately retreat up to 2 of your ships from the active system.',
  icon: ralNelIcon,
  category: 'COMMANDER',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
    shipConfig: {},
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'shipConfig',
      label: 'Ships',
      type: 'priority-number-list',
      items: ctx.api.own.getUnitVariantsOptions(),
    },
  ],
  invoke: [
    {
      timing: 'ANNOUNCE_RETREAT',
      call: (ctx, params) => {
        const toRetreat = []
        for (const [variantId, maxCount] of Object.entries(params.shipConfig)) {
          if (toRetreat.length >= 2) break
          let retreatedForType = 0
          const ids = ctx.api.own.getUnits(variantId as UnitType)
          for (const id of ids) {
            if (toRetreat.length >= 2) break
            if (retreatedForType >= maxCount) break
            toRetreat.push(id)
            retreatedForType++
          }
        }

        if (toRetreat.length === 0) return

        retreatUnits(ctx, toRetreat)
      },
    },
  ],
}
