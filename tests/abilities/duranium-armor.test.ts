import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DURANIUM_ARMOR', () => {
  it('repairs a unit damaged in a previous round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DURANIUM_ARMOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: Dreadnought sustains 1 hit
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Round 2: 0 hits — Dreadnought didn't sustain, Duranium repairs it
    t.advanceRound({ attacker: 0 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
  })

  it('does not repair a unit that used sustain this round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
        abilities: { DURANIUM_ARMOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: 1 hit, one Dreadnought sustains. The sustainer's
    // `usedSustainThisRound` flag triggers a resort that places it at the
    // tail (destroyed-first slot) — so the view shows the healthy peer at
    // index 0 and the damaged sustainer at index 1.
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.attacker.units.DREADNOUGHT![1].isDamaged).toBe(true)

    // Round 2: 1 hit, the still-healthy Dreadnought sustains; the damaged
    // peer (didn't sustain this round) is repaired by Duranium.
    t.advanceRound({ attacker: 1 })
    // Repaired peer ends up at the head after the new sustainer's resort.
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    // Newly-sustained dreadnought sits at the tail — not repaired.
    expect(t.attacker.units.DREADNOUGHT![1].isDamaged).toBe(true)
  })

  it('repairs a unit that used sustain for space cannon offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DURANIUM_ARMOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, PDS: 1 },
      },
    })

    // SCO: 1 hit on attacker → Dreadnought sustains
    t.advanceTo('SPACE_COMBAT', { attacker: 1 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Round 1: 0 hits — sustain was during SCO, not this round → Duranium repairs
    t.advanceRound({ attacker: 0 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
  })

  it('does not fire when no damaged units exist', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DURANIUM_ARMOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0 })

    const repairs = t
      .abilityLog('DURANIUM_ARMOR')
      .filter(e => !e.path.includes('CLEANUP_ROUND'))
    expect(repairs).toHaveLength(0)
  })

  it('works in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { MECH: 1, INFANTRY: 2 },
        abilities: { DURANIUM_ARMOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Round 1: Mech sustains
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    // Round 2: 0 hits — Mech repaired
    t.advanceRound({ attacker: 0 })
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
  })
})
