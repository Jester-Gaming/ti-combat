import { disablePlanetaryShield } from '@/data/abilities/unit/disable-planetary-shield'
import { sustainDamage } from '@/data/abilities/unit/sustain-damage'
import type { Faction } from '@/types'

export const neutral: Faction = {
  name: 'Neutral',
  units: {
    FLAGSHIP: {
      BASE: {
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
    WAR_SUN: {
      BASE: {
        COST: 12,
        COMBAT: [3, 3],
        MOVE: 2,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [3, 3],
        },
        ABILITIES: [disablePlanetaryShield, sustainDamage],
      },
    },
    DREADNOUGHT: {
      BASE: {
        COST: 4,
        COMBAT: [5, 1],
        MOVE: 2,
        CAPACITY: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [5, 1],
        },
        ABILITIES: [sustainDamage],
      },
    },
    CARRIER: {
      BASE: {
        COST: 3,
        COMBAT: [9, 1],
        MOVE: 2,
        CAPACITY: 6,
        UNIT_ABILITIES: {},
      },
    },
    CRUISER: {
      BASE: {
        COST: 2,
        COMBAT: [6, 1],
        MOVE: 3,
        CAPACITY: 1,
        UNIT_ABILITIES: {},
      },
    },
    DESTROYER: {
      BASE: {
        COST: 1,
        COMBAT: [8, 1],
        MOVE: 2,
        CAPACITY: null,
        UNIT_ABILITIES: {
          AFB: [6, 3],
        },
      },
    },
    FIGHTER: {
      BASE: {
        COST: 0.5,
        COMBAT: [8, 1],
        MOVE: 2,
        CAPACITY: null,
        UNIT_ABILITIES: {},
      },
    },
    MECH: {
      BASE: {
        COST: 2,
        COMBAT: [2, 1],
        MOVE: null,
        CAPACITY: null,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    INFANTRY: {
      BASE: {
        COST: 0.5,
        COMBAT: [8, 1],
        MOVE: null,
        CAPACITY: null,
        UNIT_ABILITIES: {},
      },
    },
    PDS: {
      BASE: {
        COST: null,
        COMBAT: null,
        MOVE: null,
        CAPACITY: null,
        UNIT_ABILITIES: {
          PLANETARY_SHIELD: true,
          SPACE_CANNON: [6, 1],
        },
      },
    },
    SPACE_DOCK: {
      BASE: {
        COST: null,
        COMBAT: null,
        MOVE: null,
        CAPACITY: null,
        UNIT_ABILITIES: {},
      },
    },
  },
}
