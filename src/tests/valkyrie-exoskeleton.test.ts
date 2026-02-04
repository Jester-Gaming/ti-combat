import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('VALKYRIE_EXOSKELETON', () => {
  it('produces 1 hit when mech sustains during ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Mech sustains the hit, then Valkyrie Exoskeleton produces 1 hit
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    t.assignHits()
    // 1 hit from Valkyrie Exoskeleton destroys 1 infantry
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('does not fire when mech is already damaged', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    // First round: mech sustains and produces 1 hit
    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    t.assignHits()
    // 1 hit from Valkyrie Exoskeleton destroys 1 infantry
    expect(t.defender.units.INFANTRY).toHaveLength(1)

    // Second round: mech is already damaged, can't sustain again
    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // No sustain happens, so no extra hit from Valkyrie Exoskeleton
    // Defender still has 1 infantry (no extra hit added)
    expect(t.defender.units.INFANTRY).toHaveLength(1)

    t.assignHits()
    // Hit destroys attacker infantry, mech survives
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('does not fire when a different unit sustains', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'TITANS_OF_UL',
        units: { MECH: 1, PDS: 1 },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1 },
      },
    })

    // Hel-Titan (PDS) sustains, not the Sardakk mech
    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Titans' PDS sustains, Sardakk mech is undamaged
    // No Valkyrie Exoskeleton hit should be produced
    t.assignHits()
    expect(t.defender.units.MECH).toHaveLength(1)
  })

  it('fires for each mech that sustains', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Both mechs sustain, each produces 1 hit
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH![1].isDamaged).toBe(true)

    t.assignHits()
    // 2 hits from Valkyrie Exoskeleton destroy 2 infantry
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })
})
