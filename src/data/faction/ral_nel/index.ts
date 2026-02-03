import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

import { alarum } from './alarum'

export const ral_nel: Faction = {
  name: 'Ral Nel Consortium',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Last Dispatch',
        DESCRIPTION:
          'When this unit retreats, you may destroy 1 ship in the active system that does not have Sustain Damage.',
        COST: 8,
        COMBAT: [8, 2],
        MOVE: 2,
        CAPACITY: 4,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Alarum',
        DESCRIPTION:
          'At the end of a round of ground combat on this planet, you may move up to 2 of your ground forces to this planet from planets in adjacent systems.',
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [alarum, sustainDamage],
      },
    },
    DESTROYER: {
      BASE: {
        NAME: 'Linkship I',
        DESCRIPTION:
          'This unit can use the Space Cannon ability of one of your structures in its space area; each structure can only be triggered once.',
        COST: 1,
        COMBAT: [9, 1],
        MOVE: 3,
        CAPACITY: null,
        UNIT_ABILITIES: {
          AFB: [9, 2],
        },
      },
      UPGRADED: {
        NAME: 'Linkship II',
        DESCRIPTION:
          'This unit can use the Space Cannon ability of one of your structures in its space area; each linkship can trigger the same structure.',
        COMBAT: [8, 1],
        MOVE: 4,
        UNIT_ABILITIES: {
          AFB: [6, 3],
        },
      },
    },
  },
}
