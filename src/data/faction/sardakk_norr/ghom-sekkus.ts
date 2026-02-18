import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import type { Ability } from '@/combat/abilities/types'
import {
  GROUND_FORCES,
  UNIT_DISPLAY_NAMES,
  UNIT_LIMITS,
} from '@/constants/units'
import type { UnitType } from '@/types'

type Params = {
  isEnabled: boolean
  units: Record<string, number>
}

export const ghomSekkus: Ability<Params> = {
  key: 'GHOM_SEKKUS',
  name: "G'hom Sek'kus",
  icon: sardakkNorrIcon,
  category: 'COMMANDER',
  context: 'GROUND',
  side: 'attacker',
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
        const toPlace: Partial<Record<UnitType, number>> = {}
        for (const [type, count] of Object.entries(params.units)) {
          if (count > 0) toPlace[type as UnitType] = count
        }
        ctx.api.own.addUnit(toPlace)
      },
    },
  ],
  uiConfig: [
    {
      key: 'units' as const,
      label: 'Ground Forces',
      type: 'number-list' as const,
      items: GROUND_FORCES.map(type => ({
        label: UNIT_DISPLAY_NAMES[type],
        value: type,
        max: UNIT_LIMITS[type],
      })),
    },
  ],
}
