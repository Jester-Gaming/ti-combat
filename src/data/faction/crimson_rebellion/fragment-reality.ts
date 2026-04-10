import { z } from 'zod/mini'

import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import { type Ability } from '@/combat'
import { SHIPS, UNIT_DISPLAY_NAMES, UNIT_LIMITS } from '@/constants/units'
import type { UnitBaseType } from '@/types'

type Params = {
  isEnabled: boolean
  uses: number
  ships: Record<string, number>
}

export const fragmentReality: Ability<Params> = {
  key: 'FRAGMENT_REALITY',
  name: 'Fragment Reality',
  icon: crimsonRebellionIcon,
  category: 'FACTION',
  subcategory: 'HERO',
  context: 'SPACE',
  paramsSchema: z.object({
    ships: z.record(z.string(), z.number()),
    fleetPool: z.number(),
    shipPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    ships: {},
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: params =>
        Object.values(params.ships).some(count => count > 0),
      call: (ctx, params) => {
        const toPlace: Partial<Record<UnitBaseType, number>> = {}
        for (const [type, count] of Object.entries(params.ships)) {
          if (count > 0) toPlace[type as UnitBaseType] = count
        }
        ctx.api.own.placeUnits(toPlace)
      },
    },
  ],
  uiConfig: () => [
    {
      key: 'ships' as const,
      label: 'Ships',
      type: 'number-list' as const,
      items: SHIPS.map(type => ({
        label: UNIT_DISPLAY_NAMES[type],
        value: type,
        max: UNIT_LIMITS[type],
      })),
    },
  ],
}
