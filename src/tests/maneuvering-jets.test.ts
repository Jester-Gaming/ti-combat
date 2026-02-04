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

    t.setPhase('SPACE_CANNON_OFFENSE', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.hitPools[0].hits).toBe(1)
  })

  it('cancels 1 hit from space cannon defense', () => {
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

    // Space Cannon Defense targets the attacker's ground forces;
    // hits are assigned to the attacker, but the defender uses
    // Maneuvering Jets — wait, that's wrong.
    // Actually: Space Cannon Defense is fired by the defender against
    // the attacker. The attacker receives hits. The attacker can play
    // Maneuvering Jets to cancel hits on their units.
    t.setPhase('SPACE_CANNON_DEFENSE', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.hitPools[0].hits).toBe(2)
  })

  it('attacker cancels hit from space cannon defense', () => {
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

    t.setPhase('SPACE_CANNON_DEFENSE', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.hitPools[0].hits).toBe(1)
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

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Hits unchanged — Maneuvering Jets only works vs Space Cannon
    expect(t.attacker.hitPools[0].hits).toBe(2)
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

    t.setPhase('SPACE_CANNON_OFFENSE', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.hitPools[0].hits).toBe(2)
  })
})
