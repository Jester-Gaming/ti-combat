import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

export const emirates_of_hacan: Faction = {
  name: 'Emirates of Hacan',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Wrath of Kenara',
        DESCRIPTION:
          'After you roll a die during a space combat in this system, you may spend 1 trade good to apply +1 to the result.',
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Pride of Kenara',
        DESCRIPTION:
          "This planet's planet card may be traded as part of a transaction; if you do, move all of your units from this planet to another planet you control.",
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
