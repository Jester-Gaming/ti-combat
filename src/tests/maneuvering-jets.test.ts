import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('Maneuvering Jets', () => {
  it('cancels 1 hit from space cannon offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { MANEUVERING_JETS: { uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 2, CRUISER: 1 } },
    })

    // SCO: 2 PDS hits, Maneuvering Jets cancels 1 → 1 cruiser destroyed
    t.advanceTo('SPACE_COMBAT', 'START', { attacker: 2 })

    expect(t.abilityLog('MANEUVERING_JETS')).toHaveLength(1)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('cancels 1 hit from space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { MANEUVERING_JETS: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 2, INFANTRY: 1 },
      },
    })

    // SCD: 2 PDS hits, attacker's Maneuvering Jets cancels 1 → 1 infantry destroyed
    t.advanceTo('GROUND_COMBAT', 'START', { attacker: 2 })

    expect(t.abilityLog('MANEUVERING_JETS')).toHaveLength(1)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })

  it('defender cannot cancel hits from own space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 2, INFANTRY: 1 },
        abilities: { MANEUVERING_JETS: { uses: 1 } },
      },
    })

    // SCD: 2 PDS hits, defender's Maneuvering Jets should NOT fire — both infantry destroyed
    t.advanceTo('GROUND_COMBAT', 'START', { attacker: 2 })

    expect(t.abilityLog('MANEUVERING_JETS')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('does not fire during space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { MANEUVERING_JETS: { uses: 2 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

    // Hits unchanged — Maneuvering Jets only works vs Space Cannon
    expect(t.abilityLog('MANEUVERING_JETS')).toHaveLength(0)
    expect(t.attacker.units.CRUISER).toBeUndefined()
  })

  it('does not fire when uses are 0', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { MANEUVERING_JETS: { uses: 0 } },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 2, CRUISER: 1 } },
    })

    // SCO: 2 PDS hits, no Maneuvering Jets → both cruisers destroyed
    t.advanceTo('SPACE_COMBAT', 'START', { attacker: 2 })

    expect(t.abilityLog('MANEUVERING_JETS')).toHaveLength(0)
    expect(t.attacker.units.CRUISER).toBeUndefined()
  })
})
