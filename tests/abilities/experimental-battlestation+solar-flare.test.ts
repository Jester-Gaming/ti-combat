import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EXPERIMENTAL_BATTLESTATION + SOLAR_FLARE', () => {
  it.fails(
    '[engine] Solar Flare should block Experimental Battlestation dice in SCO',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 3 },
          abilities: { SOLAR_FLARE: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { CRUISER: 1 },
          abilities: { EXPERIMENTAL_BATTLESTATION: true },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      const pool = t.dicePool()

      // EB dice should be blocked by Solar Flare
      expect(pool?.defender?.EXPERIMENTAL_BATTLESTATION).toBeUndefined()
    },
  )
})
