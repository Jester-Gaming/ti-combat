import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('FOURTH_MOON + SUSTAIN_DAMAGE', () => {
  it('disables opponent sustain damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, FIGHTER: 1 },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Dreadnought can't sustain (Fourth Moon disabled it)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
  })

  it('re-enables opponent sustain after a unit is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, FIGHTER: 1 },
      },
    })

    // Destroy fighter — triggers AFTER_DESTROY which re-enables sustain
    t.destroyUnit('defender', 'FIGHTER')

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Sustain is re-enabled, dreadnought sustains
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })
})
