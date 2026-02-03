import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

import { cavalry } from './cavalry'

export const nomad: Faction = {
  name: 'Nomad',
  abilities: {
    faction: [],
    promissory: [cavalry],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Memoria I',
        DESCRIPTION:
          'You may treat this unit as if it were adjacent to systems that contain 1 or more of your mechs.',
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          AFB: [8, 3],
        },
        ABILITIES: [sustainDamage],
      },
      UPGRADED: {
        NAME: 'Memoria II',
        DESCRIPTION:
          'You may treat this unit as if it were adjacent to systems that contain 1 or more of your mechs.',
        COMBAT: [5, 2],
        MOVE: 2,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          AFB: [5, 3],
        },
      },
    },
    MECH: {
      BASE: {
        NAME: 'Quantum Manipulator',
        DESCRIPTION:
          'While this unit is in a space area during combat, you may use its Sustain Damage ability to cancel a hit that is produced against your ships in this system.',
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
