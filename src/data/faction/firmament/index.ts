import type { Faction } from '@/types'

import { heavensEye } from './heavens-eye'

export const firmament: Faction = {
  name: 'Firmament',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: "Heaven's Eye",
        DESCRIPTION:
          "If the active system contains units that belong to a player who has a control token on 1 of your plots, apply +1 to this ship's move value and repair it at the end of every combat round.",
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [heavensEye],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Viper EX-23',
        DESCRIPTION:
          'When ground forces are committed to this planet, you may choose for your units to coexist, if they were not already.',
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
      },
    },
  },
}
