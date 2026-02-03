import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

export const xxcha_kingdom: Faction = {
  name: 'Xxcha Kingdom',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Loncara Ssodu',
        DESCRIPTION:
          "You may use this unit's Space Cannon against ships that are in adjacent systems.",
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          SPACE_CANNON: [5, 3],
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Indomitus',
        DESCRIPTION:
          "You may use this unit's Space Cannon against ships that are in systems adjacent to this unit's system.",
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          SPACE_CANNON: [8, 1],
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
