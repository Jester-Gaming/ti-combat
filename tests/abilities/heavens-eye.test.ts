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
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(false)
  })

  it('does not error when flagship is destroyed mid-round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'FIRMAMENT',
        units: { FLAGSHIP: 1 },
        abilities: { HEAVENS_EYE: true },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
    })

    // 2 hits on attacker: flagship sustains 1, destroyed by 2nd
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
  })

  it('does not repair flagship when disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'FIRMAMENT',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // Round 1: flagship sustains 1 hit, ability disabled so stays damaged
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Still damaged
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })
})
