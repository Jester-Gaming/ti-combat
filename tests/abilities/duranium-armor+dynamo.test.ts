import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DURANIUM_ARMOR + DYNAMO', () => {
  it('Dynamo repairs before Duranium Armor, leaving nothing for it to repair', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DYNAMO: { uses: 1 }, DURANIUM_ARMOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustained → Dynamo repaired immediately
    // Duranium Armor fires later at AFTER_ASSIGN_HITS_STEP but nothing to repair
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(false)
    expect(t.abilityLog('DYNAMO')).not.toHaveLength(0)
  })
})
