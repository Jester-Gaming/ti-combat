import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide(
  'NON_EUCLIDEAN_SHIELDING + VALKYRIE_PARTICLE_WEAVE',
  () => {
    it('NES cancels both normal hit and VPW hit with a single sustain', () => {
      const t = combatTest({
        mode: 'GROUND',
        attacker: {
          faction: 'SARDAKK_NORR',
          units: { INFANTRY: 2 },
          abilities: { VALKYRIE_PARTICLE_WEAVE: true },
        },
        defender: {
          faction: 'BARONY_OF_LETNEV',
          units: { MECH: 1 },
          abilities: { NON_EUCLIDEAN_SHIELDING: true },
        },
      })

      t.advanceTo('GROUND_COMBAT', 'START')
      // Attacker rolls 1 natural hit + VPW adds 1 = 2 hits on defender
      // Defender rolls 1 hit on attacker
      t.advanceRound({ attacker: 1, defender: 2 })

      expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).not.toHaveLength(0)
      // Mech sustains once, NES cancels 1 additional → both hits absorbed
      expect(t.defender.units.MECH![0].isDamaged).toBe(true)
      expect(t.defender.units.MECH).toHaveLength(1)
    })
  },
)
