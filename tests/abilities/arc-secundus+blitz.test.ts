import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ARC_SECUNDUS + BLITZ', () => {
  it.fails(
    '[engine] Arc Secundus strips PS, allowing Blitz-granted bombardment to fire',
    () => {
      const t = combatTest({
        mode: 'GROUND',
        attacker: {
          faction: 'BARONY_OF_LETNEV',
          units: { FLAGSHIP: 1, CRUISER: 1, INFANTRY: 1 },
          abilities: { BLITZ: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { PDS: 1, INFANTRY: 2 },
        },
      })

      t.advanceTo('SPACE_CANNON_DEFENSE')
      const pool = t.dicePool()

      // Arc Secundus removes PS; bombardment can proceed
      // Flagship has native bombardment [5, 3]
      expect(pool.attacker).toContainDice('FLAGSHIP', [5, 3])
    },
  )
})
