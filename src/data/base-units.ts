import { disablePlanetaryShield } from '@/combat/abilities/list/general/disable-planetary-shield'

const baseUnits = {
  WAR_SUN: {
    BASE: null,
    UPGRADED: {
      COST: 12,
      COMBAT: [3, 3] as [number, number],
      MOVE: 2,
      CAPACITY: 6,
      UNIT_ABILITIES: {
        SUSTAIN_DAMAGE: true,
        BOMBARDMENT: [3, 3] as [number, number],
      },
      ABILITIES: [disablePlanetaryShield],
    },
  },
  CRUISER: {
    BASE: {
      COST: 2,
      COMBAT: [7, 1] as [number, number],
      MOVE: 2,
      CAPACITY: null,
      UNIT_ABILITIES: {},
    },
    UPGRADED: {
      COMBAT: [6, 1] as [number, number],
      MOVE: 3,
      CAPACITY: 1,
    },
  },
  DREADNOUGHT: {
    BASE: {
      COST: 4,
      COMBAT: [5, 1] as [number, number],
      MOVE: 1,
      CAPACITY: 1,
      UNIT_ABILITIES: {
        SUSTAIN_DAMAGE: true,
        BOMBARDMENT: [5, 1] as [number, number],
      },
    },
    UPGRADED: {
      MOVE: 2,
    },
  },
  DESTROYER: {
    BASE: {
      COST: 1,
      COMBAT: [9, 1] as [number, number],
      MOVE: 2,
      CAPACITY: null,
      UNIT_ABILITIES: {
        AFB: [9, 2] as [number, number],
      },
    },
    UPGRADED: {
      COMBAT: [8, 1] as [number, number],
      UNIT_ABILITIES: {
        AFB: [6, 3] as [number, number],
      },
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
        SPACE_CANNON: [6, 1] as [number, number],
      },
    },
    UPGRADED: {
      UNIT_ABILITIES: {
        SPACE_CANNON: [5, 1] as [number, number],
      },
    },
  },
  CARRIER: {
    BASE: {
      COST: 3,
      COMBAT: [9, 1] as [number, number],
      MOVE: 1,
      CAPACITY: 4,
      UNIT_ABILITIES: {},
    },
    UPGRADED: {
      MOVE: 2,
      CAPACITY: 6,
    },
  },
  FIGHTER: {
    BASE: {
      COST: 0.5,
      COMBAT: [9, 1] as [number, number],
      MOVE: null,
      CAPACITY: null,
      UNIT_ABILITIES: {},
    },
    UPGRADED: {
      COMBAT: [8, 1] as [number, number],
      MOVE: 2,
    },
  },
  INFANTRY: {
    BASE: {
      COST: 0.5,
      COMBAT: [8, 1] as [number, number],
      MOVE: null,
      CAPACITY: null,
      UNIT_ABILITIES: {},
    },
    UPGRADED: {
      COMBAT: [7, 1] as [number, number],
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
    UPGRADED: {},
  },
} as const

export default baseUnits
