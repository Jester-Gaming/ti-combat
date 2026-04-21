import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('SKILLED_RETREAT', () => {
  it('ends combat at the start of round 1 with all units surviving', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { SKILLED_RETREAT: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    expect(t.attacker.units.CRUISER).toHaveLength(3)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })

  it('ends combat at the start of round 2 when rounds=2', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { SKILLED_RETREAT: { isEnabled: true, rounds: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound() // round 1 plays out fully

    expect(t.isFinished()).toBe(false)

    t.advanceRound() // round 2 — retreats at START before dice

    expect(t.isFinished()).toBe(true)
    expect(t.attacker.units.CRUISER).toHaveLength(3)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })
})
