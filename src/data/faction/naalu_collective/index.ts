import type { Faction } from '@/types'

import { matriarch } from './matriarch'

export const naalu_collective: Faction = {
  name: 'Naalu Collective',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Matriarch',
        DESCRIPTION:
          'During an invasion in this system, you may commit fighters to planets as if they were ground forces. When combat ends, return those units to the space area.',
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [matriarch],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Iconoclast',
        DESCRIPTION:
          "During combat against an opponent who has at least 1 relic fragment, apply +2 to the results of this unit's combat rolls.",
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
      },
    },
    FIGHTER: {
      BASE: {
        NAME: 'Hybrid Crystal Fighter I',
        COST: 0.5,
        COMBAT: [8, 1],
        UNIT_ABILITIES: {},
      },
      UPGRADED: {
        NAME: 'Hybrid Crystal Fighter II',
        DESCRIPTION:
          "This unit may move without being transported. Each fighter in excess of your ships' capacity counts as 1/2 of a ship against your fleet pool.",
        COMBAT: [7, 1],
        MOVE: 2,
      },
    },
  },
}
