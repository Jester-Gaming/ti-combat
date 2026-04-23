import { describe, expect, it } from 'vitest'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

describe.forEachSide('COURAGEOUS_TO_THE_END + EXOTRIREME', () => {
  it('Exotrireme II self-sacrifice triggers Courageous roll', () => {
    // Attacker sacrifices its upgraded Sardakk Dreadnought at AFTER_COMBAT_ROUND,
    // destroying 2 opponent cruisers. The self-destruction also satisfies
    // Courageous's "own ship destroyed during space combat" condition,
    // triggering its 2-dice roll anchored on the dreadnought's combat value.
    // Courageous's rollDice produces branches, so advance past the END micro
    // via step() and inspect every branch.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        upgrades: ['DREADNOUGHT'],
        abilities: {
          EXOTRIREME: true,
          COURAGEOUS_TO_THE_END: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceToTiming('END_OF_COMBAT_ROUND', 0, 'SPACE_COMBAT')
    const branches = t.step()

    // Courageous rolls 2d5 (Exotrireme II combat value) → 3 outcomes → 3 branches.
    expect(branches).toHaveLength(3)

    for (const b of branches) {
      const log = b.state.log ?? []
      // Courageous's AFTER_DESTROY fired — confirming Exotrireme II's
      // self-destruction propagated through the AFTER_DESTROY chain.
      const hasCourageous = log.some(e =>
        e.path.includes('COURAGEOUS_TO_THE_END'),
      )
      expect(hasCourageous).toBe(true)

      // Sardakk side lost the dreadnought; opponent lost at least 2 cruisers.
      const attackerSide = b.state.data.attacker
      const defenderSide = b.state.data.defender
      const sardakk =
        attackerSide.faction === 'SARDAKK_NORR' ? attackerSide : defenderSide
      const opponent =
        attackerSide.faction === 'SARDAKK_NORR' ? defenderSide : attackerSide
      expect(unitsByBaseType(sardakk).DREADNOUGHT).toBeUndefined()
      expect(
        (unitsByBaseType(opponent).CRUISER ?? []).length,
      ).toBeLessThanOrEqual(1)
    }
  })
})
