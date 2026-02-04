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

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 3)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.hitPools[0].hits).toBe(1)
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

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.hitPools[0].hits).toBe(0)
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

    t.setPhase('GROUND_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.hitPools[0].hits).toBe(2)
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

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    expect(t.attacker.hitPools[0].hits).toBe(2)
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

    // First round: cancels 2 hits, uses decremented to 0
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 3)
    t.runTiming('BEFORE_ASSIGN_HITS')
    expect(t.attacker.hitPools[0].hits).toBe(1)

    t.assignHits()

    // Second round: no uses left, hits remain
    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')
    expect(t.attacker.hitPools[0].hits).toBe(2)
  })
})
