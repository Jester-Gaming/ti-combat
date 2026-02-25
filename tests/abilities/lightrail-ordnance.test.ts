import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('LIGHTRAIL_ORDNANCE', () => {
  it('adds Space Cannon dice in SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, SPACE_DOCK: 1 },
        abilities: { LIGHTRAIL_ORDNANCE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    expect(pool.defender).toContainDice('SPACE_DOCK', [5, 2])
  })

  it('adds Space Cannon dice in SCD', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1, SPACE_DOCK: 1 },
        abilities: { LIGHTRAIL_ORDNANCE: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    expect(pool.defender).toContainDice('SPACE_DOCK', [5, 2])
  })

  it('multiplies dice for multiple space docks', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, SPACE_DOCK: 2 },
        abilities: { LIGHTRAIL_ORDNANCE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    expect(pool.defender).toContainDice('SPACE_DOCK', [5, 2], [5, 2])
  })
})
