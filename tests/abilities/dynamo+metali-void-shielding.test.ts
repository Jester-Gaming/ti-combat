import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DYNAMO + METALI_VOID_SHIELDING', () => {
  it.fails(
    'Dynamo repairs a unit that sustained via Metali Void Shielding',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 2 },
          abilities: {
            DYNAMO: { uses: 5 },
            METALI_VOID_SHIELDING: true,
          },
        },
        defender: {
          faction: 'ARBOREC',
          units: { CRUISER: 2 },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      // 1 hit to attacker: MVS grants sustain to cruiser (normally no sustain),
      // cruiser sustains, Dynamo repairs
      t.advanceRound({ attacker: 1 })

      // Cruiser sustained via MVS then repaired by Dynamo
      expect(t.attacker.units.CRUISER).toHaveLength(2)
      expect(t.attacker.units.CRUISER![0].isDamaged).toBe(false)
      expect(t.attacker.units.CRUISER![1].isDamaged).toBe(false)
      expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
      expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
    },
  )
})
