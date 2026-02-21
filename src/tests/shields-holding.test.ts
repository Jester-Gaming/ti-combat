import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('Shields Holding', () => {
  it('cancels up to 2 hits during space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { SHIELDS_HOLDING: { uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 3 })

    // 3 hits - 2 cancelled = 1 effective → 2 cruisers survive
    expect(t.abilityLog('SHIELDS_HOLDING')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('cancels all hits when pending is less than 2', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { SHIELDS_HOLDING: { uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // 1 hit - cancelled = 0 effective → both cruisers survive
    expect(t.abilityLog('SHIELDS_HOLDING')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('cancels AFB hits', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FIGHTER: 3 },
        abilities: { SHIELDS_HOLDING: { uses: 1 } },
      },
      // 2 destroyers: AFB 9x2 each = 4 dice total
      defender: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
    })

    // Advance past AFB entirely; pick 3-hit AFB outcome
    // Shields Holding cancels 2 → 1 effective hit → 2 fighters survive
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', 3)

    expect(t.abilityLog('SHIELDS_HOLDING')).not.toHaveLength(0)
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })

  it('does not fire during ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { SHIELDS_HOLDING: { uses: 2 } },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

    // Hits unchanged — Shields Holding only works in space combat
    expect(t.abilityLog('SHIELDS_HOLDING')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })

  it('does not fire when uses are 0', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { SHIELDS_HOLDING: { uses: 0 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

    // No cancellation — 2 cruisers destroyed
    expect(t.abilityLog('SHIELDS_HOLDING')).toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('decrements uses after each activation', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { SHIELDS_HOLDING: { uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // First round: cancels 2 hits, uses decremented to 0
    t.advanceRound({ attacker: 3 })
    expect(t.abilityLog('SHIELDS_HOLDING')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(2)

    // Second round: no uses left, hits remain → 2 more cruisers destroyed
    t.advanceRound({ attacker: 2 })
    expect(t.abilityLog('SHIELDS_HOLDING')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toBeUndefined()
  })
})
