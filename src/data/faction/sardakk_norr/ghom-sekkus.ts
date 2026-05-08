import { z } from 'zod/mini'

import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import type { Ability } from '@/combat'
import {
  GROUND_FORCES,
  UNIT_DISPLAY_NAMES,
  UNIT_LIMITS,
} from '@/constants/units'
import type { UnitBaseType } from '@/types'

type Params = {
  isEnabled: boolean
  units: Record<string, number>
}

export const ghomSekkus: Ability<Params> = {
  key: 'GHOM_SEKKUS',
  name: "G'hom Sek'kus",
  description:
    'You can commit up to 1 ground force from each planet in the active system and each planet in adjacent systems that do not contain 1 of your command tokens.',
  icon: sardakkNorrIcon,
  context: 'GROUND',
  side: 'attacker',
  paramsSchema: z.object({ units: z.record(z.string(), z.number()) }),
  params: {
    isEnabled: false,
    uses: Infinity,
    units: {},
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'COMMIT_UNITS',
      isCallable: params =>
        Object.values(params.units).some(count => count > 0),
      call: (ctx, params) => {
        const toPlace: Partial<Record<UnitBaseType, number>> = {}
        for (const [type, count] of Object.entries(params.units)) {
          if (count > 0) toPlace[type as UnitBaseType] = count
        }
        ctx.api.own.placeUnits(toPlace)
      },
    },
  ],
  uiConfig: [
    {
      key: 'units' as const,
      type: 'number-list' as const,
      items: GROUND_FORCES.map(type => ({
        label: UNIT_DISPLAY_NAMES[type],
        value: type,
        max: UNIT_LIMITS[type],
      })),
    },
  ],
}
