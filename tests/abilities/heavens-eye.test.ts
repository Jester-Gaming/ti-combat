import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('HEAVENS_EYE', () => {
  it('repairs flagship at end of combat round when enabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'FIRMAMENT',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { HEAVENS_EYE: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // Round 1: flagship sustains 1 hit, Heaven's Eye repairs at END
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBeFalsy()
  })
})
