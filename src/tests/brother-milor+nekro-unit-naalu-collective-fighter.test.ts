import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('BROTHER_MILOR + NEKRO_UNIT_NAALU_COLLECTIVE_FIGHTER', () => {
  it('fighters placed by Brother Milor have Hybrid Crystal Fighter stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 1, FIGHTER: 1 },
        abilities: {
          NEKRO_UNIT_NAALU_COLLECTIVE_FIGHTER: true,
          BROTHER_MILOR: true,
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Attacker receives 1 hit — fighter destroyed, Brother Milor places 2 fighters
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FIGHTER).toHaveLength(2)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)

    // Round 2: verify the placed fighters roll with Hybrid Crystal Fighter II stats [7, 1]
    t.advanceRound()
    const pool = t.dicePool()!

    // Hybrid Crystal Fighter II: [7, 1], not regular fighter [9, 1]
    expect(pool.attacker).toContainDice('FIGHTER', [7, 1])
  })
})
