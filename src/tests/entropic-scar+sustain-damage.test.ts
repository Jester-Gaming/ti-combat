import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ENTROPIC_SCAR + SUSTAIN_DAMAGE', () => {
  it('disables sustain for both sides', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          ENTROPIC_SCAR: true,
        },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 1)
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Neither dreadnought sustained (Entropic Scar disabled sustain)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()

    // Hits are still pending — both dreadnoughts destroyed on assignment
    t.assignHits()
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })
})
