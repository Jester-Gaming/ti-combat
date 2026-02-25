import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('GEOFORM + SOLAR_FLARE', () => {
  it.fails(
    '[engine] Solar Flare should block Geoform Space Cannon dice in SCO',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 1 },
          abilities: { SOLAR_FLARE: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { CRUISER: 1 },
          abilities: { GEOFORM: true },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      const pool = t.dicePool()

      // Solar Flare: "other players cannot use Space Cannon against your ships"
      // Geoform dice should be blocked since they represent Space Cannon
      expect(pool?.defender?.GEOFORM).toBeUndefined()
    },
  )
})
