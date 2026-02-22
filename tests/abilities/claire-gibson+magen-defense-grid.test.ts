import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('CLAIRE_GIBSON + MAGEN_DEFENSE_GRID', () => {
  it('both fire at START_OF_COMBAT in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 2 },
        abilities: {
          CLAIRE_GIBSON: { isEnabled: true },
          MAGEN_DEFENSE_GRID: true,
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // Both abilities fire
    expect(t.abilityLog('CLAIRE_GIBSON').length).toBeGreaterThan(0)
    expect(t.abilityLog('MAGEN_DEFENSE_GRID').length).toBeGreaterThan(0)

    // Claire Gibson adds 1 infantry to defender
    expect(t.defender.units.INFANTRY).toHaveLength(3)

    // Magen Defense Grid destroys 1 attacker infantry
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
