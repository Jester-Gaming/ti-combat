import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ALASTOR + VAN_HAUGE', () => {
  it('destroys all ships on both sides when Alastor is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { VAN_HAUGE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 1: damage the flagship (sustains 1 hit)
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: 1 hit on already-damaged flagship → destroyed → Van Hauge triggers
    t.advanceRound({ attacker: 1 })

    // Van Hauge — all ships on both sides destroyed
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('logs Van Hauge trigger', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { VAN_HAUGE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 1: sustain
    t.advanceRound({ attacker: 1 })

    // Round 2: destroyed → Van Hauge
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('VAN_HAUGE')).toHaveLength(1)
  })
})
