import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + VOS_HOLLOW', () => {
  it('VH triggers when Direct Hit destroys a ship after sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { VOS_HOLLOW: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Defender receives 1 hit -> dreadnought sustains -> Direct Hit destroys it
    // AFTER_DESTROY: VH fires -> attacker must destroy a dreadnought
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
    expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
  })

  it.fails('Direct Hit on VH-caused destruction chain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DREADNOUGHT: 1 },
        abilities: { VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DREADNOUGHT: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Attacker cruiser destroyed -> VH fires -> opponent cruiser destroyed
    // That destruction is separate from Direct Hit (DH fires on sustain, not on VH)
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })
})
