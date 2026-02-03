import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('DIRECT_HIT', () => {
  it('destroys opponent ship that used sustain damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Dreadnought sustained then was destroyed by Direct Hit
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('does not fire when uses is 0', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 0 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Dreadnought sustains normally — no Direct Hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('consumes one use per sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // First dreadnought sustained and was destroyed (used 1 Direct Hit)
    // Second dreadnought sustained normally (no uses left)
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('multiple uses destroy multiple ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Both dreadnoughts sustained and were destroyed
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('does not fire when no sustain occurs', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1 },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Fighter can't sustain — Direct Hit doesn't trigger
    t.assignHits()
    expect(t.defender.units.FIGHTER).toBeUndefined()
  })

  it('does not destroy upgraded L1Z1X Dreadnought (immune)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1 },
        upgrades: ['DREADNOUGHT'],
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Upgraded L1Z1X Dreadnought sustains normally — immune to Direct Hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('does not consume uses on immune units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1 },
        upgrades: ['DREADNOUGHT'],
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Uses should remain at 1 — not consumed on immune unit
    expect(t.state.abilities.attacker.DIRECT_HIT.uses).toBe(1)
  })

  it('does not destroy upgraded Sardakk Dreadnought (immune)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1 },
        upgrades: ['DREADNOUGHT'],
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Upgraded Sardakk Dreadnought sustains normally — immune to Direct Hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('both sides can have Direct Hit independently', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Both dreadnoughts sustained and were destroyed by opponent's Direct Hit
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })
})
