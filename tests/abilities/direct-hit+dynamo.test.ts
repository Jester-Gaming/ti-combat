import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DIRECT_HIT + DYNAMO', () => {
  it('Direct Hit kills ship even after Dynamo repairs it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DYNAMO: { uses: 5 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Dreadnought sustains → Dynamo (attacker/OWN) repairs
    // → Direct Hit (defender/OPPONENT) kills it anyway
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
  })

  it('Dynamo does not fire when DH kills before it resolves', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DYNAMO: { uses: 5 } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Dreadnought sustains → DH (attacker/OPPONENT) fires first → destroys it
    // Dynamo (defender/OWN) can't repair dead unit
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
    expect(t.abilityLog('DYNAMO')).toHaveLength(0)
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })
})
