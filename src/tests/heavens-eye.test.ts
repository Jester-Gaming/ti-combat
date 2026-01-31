import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('HEAVENS_EYE', () => {
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

    // Damage the flagship via sustain
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Flagship sustains the hit
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Heaven's Eye repairs at end of combat round
    t.runTiming('END_OF_COMBAT_ROUND')

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

    // Damage the flagship via sustain, then destroy it
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Flagship sustains 1 hit
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Assign remaining hit — destroys the flagship
    t.assignHits()
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()

    // END_OF_COMBAT_ROUND should not throw
    t.runTiming('END_OF_COMBAT_ROUND')
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

    // Damage the flagship via sustain
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // End of combat round — ability is disabled (default)
    t.runTiming('END_OF_COMBAT_ROUND')

    // Still damaged
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })
})
