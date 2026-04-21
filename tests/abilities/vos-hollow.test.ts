import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('VOS_HOLLOW', () => {
  it('destroys opponent ship of same type when own ship is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker receives 1 hit → Cruiser destroyed → Vos Hollow → opponent Cruiser destroyed
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)
  })

  it('does not trigger when only opponent ships are destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender receives 1 hit — opponent's ship destroyed, not ours
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('VOS_HOLLOW')).toHaveLength(0)
  })

  it('does not trigger when opponent has no matching ship type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker Cruiser destroyed, but defender has no Cruisers
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('VOS_HOLLOW')).toHaveLength(0)
  })

  it('does not trigger for ground force destruction', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('VOS_HOLLOW')).toHaveLength(0)
  })

  it('only triggers once per combat (agent exhaustion)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CRUISER).toHaveLength(2)
    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)

    // Round 2: another Cruiser destroyed, but agent is exhausted
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)
  })

  it('follows priority list when multiple ship types destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, DESTROYER: 1 },
        abilities: { VOS_HOLLOW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, DESTROYER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker receives 2 hits → Dreadnought sustains, Destroyer destroyed
    // Vos Hollow triggers on Destroyer → opponent Destroyer destroyed
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.DESTROYER).toBeUndefined()
    expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)
  })
})
