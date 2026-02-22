import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('NON_EUCLIDEAN_SHIELDING + TECHNOLOGICAL_SINGULARITY', () => {
  describe.forEachSide('enableBySingularity', () => {
    it('sustain cancels only 1 hit before kill', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'NEKRO_VIRUS',
          units: { DREADNOUGHT: 1 },
          abilities: {
            NON_EUCLIDEAN_SHIELDING: {
              isEnabled: false,
              enableBySingularity: true,
            },
          },
        },
        defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      // 2 hits on dreadnought: sustain cancels 1, 1 remaining → destroyed
      t.advanceRound({ attacker: 2 })

      expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    })

    it('sustain cancels 2 hits after kill', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'NEKRO_VIRUS',
          units: { DREADNOUGHT: 1 },
          abilities: {
            NON_EUCLIDEAN_SHIELDING: {
              isEnabled: false,
              enableBySingularity: true,
            },
          },
        },
        defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      // Round 1: kill 1 cruiser, no hits on attacker
      t.advanceRound({ defender: 1 })
      // Round 2: NES activates → sustain cancels 2 hits
      t.advanceRound({ attacker: 2 })

      // Dreadnought survives — NES sustain cancelled both hits
      expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
      expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    })
  })

  describe('disableBySingularity', () => {
    it('sustain cancels 2 hits before kill', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'NEKRO_VIRUS',
          units: { DREADNOUGHT: 1 },
          abilities: {
            NON_EUCLIDEAN_SHIELDING: {
              isEnabled: true,
              disableBySingularity: true,
            },
          },
        },
        defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      // 2 hits on dreadnought: NES sustain cancels 2 → survives
      t.advanceRound({ attacker: 2 })

      expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
      expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    })

    it('sustain cancels only 1 hit after kill', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'NEKRO_VIRUS',
          units: { DREADNOUGHT: 1 },
          abilities: {
            NON_EUCLIDEAN_SHIELDING: {
              isEnabled: true,
              disableBySingularity: true,
            },
          },
        },
        defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      // Round 1: kill 1 cruiser, no hits on attacker
      t.advanceRound({ defender: 1 })
      // Round 2: NES disabled → sustain cancels only 1, 1 remaining → destroyed
      t.advanceRound({ attacker: 2 })

      expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    })
  })
})
