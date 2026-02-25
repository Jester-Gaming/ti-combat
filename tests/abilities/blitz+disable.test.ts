import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BLITZ + DISABLE', () => {
  it.fails(
    '[engine] Blitz + Disable: bombardment should fire through stripped PS',
    () => {
      const t = combatTest({
        mode: 'GROUND',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1, INFANTRY: 2 },
          abilities: { BLITZ: true, DISABLE: true },
        },
        defender: {
          faction: 'ARBOREC',
          units: { PDS: 1, INFANTRY: 1 },
        },
      })

      t.advanceTo('SPACE_CANNON_DEFENSE')
      const bombardPool = t.dicePool()

      // Bombardment should fire (PDS PS stripped by Disable)
      expect(bombardPool?.attacker).toContainDice('DREADNOUGHT', [5, 1])
    },
  )
})
