import { z } from 'zod/mini'

import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import { type Ability, declareParam } from '@/combat'
import {
  GROUND_FORCES,
  UNIT_DISPLAY_NAMES,
  UNIT_LIMITS,
} from '@/constants/units'
import type { UnitBaseType, UnitList } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  isEnabled: boolean
  units: UnitList<number>
}

export const ghomSekkus: Ability<Params> = {
  key: 'GHOM_SEKKUS',
  name: "G'hom Sek'kus",
  description:
    'You can commit up to 1 ground force from each planet in the active system and each planet in adjacent systems that do not contain 1 of your command tokens.',
  icon: sardakkNorrIcon,
  context: 'GROUND',
  side: 'attacker',
  paramsSchema: z.object({
    units: UnitListNumberSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    units: declareParam<UnitList<number>>({
      default: [],
      source: 'groundForces',
      defaultItemValue: 0,
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'COMMIT_UNITS',
      isCallable: (params, ctx) => ctx.utils.getFlat(params.units).length > 0,
      call: (ctx, params) => {
        const toPlace: Partial<Record<UnitBaseType, number>> = {}
        for (const [type, count] of params.units) {
          if (count > 0) toPlace[type as UnitBaseType] = count
        }
        ctx.api.own.placeUnits(toPlace)
      },
    },
  ],
  uiConfig: [
    {
      key: 'units' as const,
      type: 'unit-list' as const,
      mode: 'number' as const,
      items: GROUND_FORCES.map(type => ({
        label: UNIT_DISPLAY_NAMES[type],
        value: type,
        max: UNIT_LIMITS[type],
      })),
    },
  ],
}
