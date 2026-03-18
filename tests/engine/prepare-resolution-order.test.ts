import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

/**
 * Engine test: verify that abilities which disable other abilities at PREPARE
 * timing work regardless of resolution order.
 *
 * 2RAM (commander, PREPARE) marks PLANETARY_SHIELD as "lost" on the defender.
 * PLANETARY_SHIELD (unit ability, PREPARE) blocks BOMBARDMENT on the attacker.
 *
 * When the attacker has another PREPARE ability (e.g. BLITZ), it takes the
 * attacker's first alternation turn. PLANETARY_SHIELD then fires on the
 * defender's turn (before 2RAM), blocking bombardment. 2RAM fires on the
 * attacker's second turn but the block is already applied.
 *
 * Expected: 2RAM disables Planetary Shield → bombardment works.
 * Actual: PLANETARY_SHIELD fires before 2RAM → bombardment blocked.
 */
describe('engine: PREPARE resolution order', () => {
  it('2RAM disables Planetary Shield when another PREPARE ability is present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: {
          TWO_RAM: true,
          // BLITZ fires at PREPARE (action cards come before commanders
          // in the ability list). It takes the attacker's first alternation
          // turn, allowing PLANETARY_SHIELD to fire before 2RAM.
          BLITZ: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    // Advance past bombardment
    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // 2RAM should disable Planetary Shield → dreadnought bombardment works
    expect(pool.attacker.DREADNOUGHT).toBeDefined()
  })
})
