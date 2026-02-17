import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('VAN_HAUGE', () => {
  it('destroys all ships on both sides when flagship is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: damage the flagship (sustains 1 hit)
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: 1 hit on already-damaged flagship → destroyed → Van Hauge triggers
    t.advanceRound({ attacker: 1 })

    // Van Hauge triggered — all ships on both sides destroyed
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('does not trigger when flagship sustains but is not destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit on attacker: flagship sustains
    t.advanceRound({ attacker: 1 })

    // Flagship sustained — not destroyed, Van Hauge not triggered
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })

  it('fires WHEN_DESTROY before AFTER_DESTROY', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: damage flagship (sustains 1 hit)
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: 1 hit destroys damaged flagship → Van Hauge triggers
    t.advanceRound({ attacker: 1 })

    // Van Hauge triggered — all ships destroyed
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('ships destroyed by Van Hauge appear in AFTER_DESTROY log context', () => {
    // Van Hauge destroys all ships via WHEN_DESTROY.
    // AFTER_DESTROY context should include the ships destroyed by Van Hauge.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: damage flagship (sustain)
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: 1 hit destroys damaged flagship → Van Hauge → all ships gone
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.defender.units.CRUISER).toBeUndefined()

    // VAN_HAUGE log entry should exist in WHEN_DESTROY section
    const vanHaugeLog = t.abilityLog('VAN_HAUGE')
    expect(vanHaugeLog).toHaveLength(1)
  })
})
