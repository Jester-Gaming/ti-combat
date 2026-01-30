import type { Faction } from '@/types'

import { fourthMoon } from './fourth-moon'
import { mollTerminus } from './moll-terminus'

export const mentak_coalition: Faction = {
  name: 'Mentak Coalition',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Fourth Moon',
        DESCRIPTION:
          "Other players' ships in this system cannot use Sustain Damage.",
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [fourthMoon],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Moll Terminus',
        DESCRIPTION:
          "Other players' ground forces on this planet cannot use Sustain Damage.",
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [mollTerminus],
      },
    },
  },
}
