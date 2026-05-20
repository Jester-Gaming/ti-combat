import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ANTI_FIGHTER_BARRAGE', () => {
  it('both sides barrage simultaneously in a single roll', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DESTROYER: 1, FIGHTER: 1 } },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1, FIGHTER: 1 } },
    })

    t.advanceToTiming('BEFORE_ASSIGN_HITS', 0, 'AFB')
    const pool = t.dicePool()

    // One combined AFB pool: both destroyers roll [9, 2] together.
    expect(pool.hitSource).toBe('AFB')
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
    expect(pool.defender).toContainDice('DESTROYER', [9, 2])
  })

  it('a side that opts out (resolve: false) is dropped from the combined roll', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DESTROYER: 1, FIGHTER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, FIGHTER: 1 },
        abilities: { ANTI_FIGHTER_BARRAGE: { resolve: false } },
      },
    })

    t.advanceToTiming('BEFORE_ASSIGN_HITS', 0, 'AFB')
    const pool = t.dicePool()

    // Attacker still barrages; defender's AFB units contribute no dice.
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
    expect(pool.defender?.DESTROYER).toBeUndefined()
  })
})
