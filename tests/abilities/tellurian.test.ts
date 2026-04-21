import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TELLURIAN', () => {
  it.forEachSide('cancels 1 hit during space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'TITANS_OF_UL',
        units: { CRUISER: 2 },
        abilities: { TELLURIAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker receives 2 hits; Tellurian cancels 1 -> 1 cruiser destroyed
    t.advanceRound({ attacker: 2 })

    expect(t.abilityLog('TELLURIAN')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it.forEachSide('cancels 1 hit during ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'TITANS_OF_UL',
        units: { INFANTRY: 2 },
        abilities: { TELLURIAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    // Attacker receives 2 hits; Tellurian cancels 1 -> 1 infantry destroyed
    t.advanceRound({ attacker: 2 })

    expect(t.abilityLog('TELLURIAN')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })

  it.forEachSide('cancels 1 AFB hit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'TITANS_OF_UL',
        units: { FIGHTER: 3 },
        abilities: { TELLURIAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
    })

    // AFB produces 2 hits on attacker, Tellurian cancels 1 → 1 fighter lost
    t.advanceToTiming('ANNOUNCE_RETREAT_STEP', { attacker: 2 })

    expect(t.abilityLog('TELLURIAN')).not.toHaveLength(0)
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })

  it.forEachSide('cancels 1 SCO hit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'TITANS_OF_UL',
        units: { CRUISER: 3 },
        abilities: { TELLURIAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, PDS: 2 } },
    })

    // SCO produces 2 hits on attacker, Tellurian cancels 1 → 1 cruiser lost
    t.advanceTo('SPACE_COMBAT', { attacker: 2 })

    expect(t.abilityLog('TELLURIAN')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('cancels 1 bombardment hit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { INFANTRY: 3 },
        abilities: { TELLURIAN: { isEnabled: true, uses: 1 } },
      },
    })

    // Bombardment produces 2 hits on defender, Tellurian cancels 1
    t.advanceTo('SPACE_CANNON_DEFENSE', { defender: 2 })

    expect(t.abilityLog('TELLURIAN')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('cancels 1 SCD hit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'TITANS_OF_UL',
        units: { INFANTRY: 3 },
        abilities: { TELLURIAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 2, INFANTRY: 1 } },
    })

    // SCD produces 2 hits on attacker, Tellurian cancels 1 → 1 infantry lost
    t.advanceTo('GROUND_COMBAT', { attacker: 2 })

    expect(t.abilityLog('TELLURIAN')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it.forEachSide('does not fire when no hits to cancel', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'TITANS_OF_UL',
        units: { CRUISER: 1 },
        abilities: { TELLURIAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // 0 hits -> Tellurian not callable
    t.advanceRound(0)

    expect(t.abilityLog('TELLURIAN')).toHaveLength(0)
    // Uses not consumed
    expect(t.state.abilities.attacker.TELLURIAN.uses).toBe(1)
  })
})
