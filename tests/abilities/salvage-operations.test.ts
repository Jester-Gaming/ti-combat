import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SALVAGE_OPERATIONS', () => {
  it('places a ship after winning combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: { SALVAGE_OPERATIONS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender takes 1 hit, attacker takes 0
    t.advanceRound({ defender: 1 })

    // Defender cruiser destroyed
    expect(t.defender.units.CRUISER).toBeUndefined()
    // Attacker won — Salvage Operations places 1 ship
    expect(t.abilityLog('SALVAGE_OPERATIONS')).not.toHaveLength(0)
    // Cruiser was destroyed, so attacker gets a cruiser
    expect(t.attacker.units.CRUISER).toHaveLength(3)
  })

  it('does not place a ship when combat is lost', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 1 },
        abilities: { SALVAGE_OPERATIONS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker takes 1 hit, defender takes 0 — attacker loses
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CRUISER).toBeUndefined()
    // Lost — no ship placed (only DESTROY invoke fires, not END_OF_COMBAT)
    expect(t.abilityLog('SALVAGE_OPERATIONS')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })

  it('tracks destroyed ships from own side', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SALVAGE_OPERATIONS: {
            isEnabled: true,
            shipPriority: ['CRUISER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker loses 1 cruiser (3→2), defender eliminated
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.defender.units.CRUISER).toBeUndefined()
    // Won — own cruiser was destroyed, places 1 cruiser (2 + 1 = 3)
    expect(t.abilityLog('SALVAGE_OPERATIONS')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(3)
  })

  it('respects ship priority order', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { DREADNOUGHT: 2 },
        abilities: {
          SALVAGE_OPERATIONS: {
            isEnabled: true,
            shipPriority: ['DREADNOUGHT', 'CRUISER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.CRUISER).toBeUndefined()
    // Cruiser was destroyed, but Dreadnought is higher priority (and not destroyed)
    // Only Cruiser is in destroyed set, so Cruiser is placed
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(2)
  })
})
