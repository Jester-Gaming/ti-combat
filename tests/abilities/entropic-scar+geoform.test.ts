import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ENTROPIC_SCAR + GEOFORM', () => {
  it.fails(
    "[engine] Geoform SC doesn't fire under Scar (config ability, not unit ability)",
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
        defender: {
          faction: 'ARBOREC',
          units: { CRUISER: 1 },
          abilities: {
            GEOFORM: true,
            ENTROPIC_SCAR: true,
          },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      const pool = t.dicePool()

      // Geoform adds SC dice via addDiceGroup (config ability)
      // Entropic Scar only blocks unit abilities, not config-level dice additions
      expect(pool?.defender).not.toContainDice('GEOFORM')
    },
  )
})
