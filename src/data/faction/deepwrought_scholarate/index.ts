import { sustainDamage } from '@/data/abilities/sustain-damage'
import type { Faction } from '@/types'

export const deepwrought_scholarate: Faction = {
  name: 'Deepwrought Scholarate',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'D.W.S. Luminous',
        DESCRIPTION:
          "This ship can move through systems that contain your units, even if other players' units are present; if it would, apply +1 to its move value for each of those systems.",
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Eanautic',
        DESCRIPTION:
          'When another player activates this system, if this unit is coexisting, you may move it and any of your infantry on its planet to a planet you control in your home system.',
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          PRODUCTION: 1,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
