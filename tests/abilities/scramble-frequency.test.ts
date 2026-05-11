import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SCRAMBLE_FREQUENCY', () => {
  it('defender forces attacker to reroll AFB dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, FIGHTER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, FIGHTER: 1 },
        abilities: {
          SCRAMBLE_FREQUENCY: { isEnabled: true },
        },
      },
    })
    t.advanceTo('AFB')
    t.advanceRound()
    expect(t.abilityLog('SCRAMBLE_FREQUENCY')).not.toHaveLength(0)
  })

  it('does not fire in regular space combat (not a unit ability)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1 },
        abilities: {
          SCRAMBLE_FREQUENCY: { isEnabled: true },
        },
      },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const combatPhaseEntries = t
      .abilityLog('SCRAMBLE_FREQUENCY')
      .filter(e => e.path.includes('SPACE_COMBAT') && !e.path.includes('AFB'))
    expect(combatPhaseEntries).toHaveLength(0)
  })
})
