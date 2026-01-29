import { disablePlanetaryShield } from '@/data/abilities/disable-planetary-shield'
import type { Faction } from '@/types'

export const embers_of_muaat: Faction = {
  name: 'Embers of Muaat',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Inferno',
        DESCRIPTION:
          "Action: Spend 1 token from your strategy pool to place 1 cruiser in this unit's system.",
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
      },
    },
    MECH: {
      BASE: {
        NAME: 'Ember Colossus',
        DESCRIPTION:
          'When you use your Star Forge faction ability in this system or an adjacent system, you may place 1 infantry from your reinforcements with this unit.',
        COST: 2,
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
      },
    },
    WAR_SUN: {
      BASE: {
        NAME: 'Prototype War Sun I',
        DESCRIPTION:
          'Other players units in this system lose the Planetary Shield ability.',
        COST: 12,
        COMBAT: [3, 3],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          BOMBARDMENT: [3, 3],
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [disablePlanetaryShield],
      },
      UPGRADED: {
        NAME: 'Prototype War Sun II',
        DESCRIPTION:
          'Other players units in this system lose the Planetary Shield ability.',
        COST: 10,
        MOVE: 3,
      },
    },
  },
}
