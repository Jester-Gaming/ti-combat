import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAVALRY', () => {
  it('grants Nomad flagship combat stats to chosen ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)
    expect(
      t.attacker.units.CRUISER!.some(u => u.subtypes?.includes('Cavalry')),
    ).toBe(true)

    const pool = t.dicePool()
    // Cavalry cruiser gets Nomad flagship stats: [7, 2]
    expect(pool.attacker).toContainDice('CRUISER', [7, 2])
    // Regular cruiser: [7, 1]
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })
})
