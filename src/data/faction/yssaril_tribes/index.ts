import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

export const yssaril_tribes: Faction = {
  name: 'Yssaril Tribes',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: "Y'sia Y'ssrila",
        DESCRIPTION:
          "This ship can move through systems that contain other player's ships.",
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 2,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Blackshade Infiltrator',
        DESCRIPTION:
          'Deploy: After you use your Stall Tactics faction ability, you may place 1 mech on a planet you control.',
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
