import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LINKSHIP_1', () => {
  it('adds SC dice for each linkship up to structures count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 2 },
        abilities: { LINKSHIP_1: { structures: [['PDS', 2]] } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 2 linkships, 2 PDS structures → 2 DESTROYER SC dice groups [6, 1]
    expect(pool.defender.LINKSHIP_1).toHaveLength(2)
    expect(pool.defender).toContainDice('LINKSHIP_1', [6, 1])
  })

  it('is capped by structures count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 3 },
        abilities: { LINKSHIP_1: { structures: [['PDS', 1]] } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 3 linkships but only 1 PDS structure → 1 SC dice group
    expect(pool.defender.LINKSHIP_1).toHaveLength(1)
  })

  it('is capped by linkship count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1 },
        abilities: { LINKSHIP_1: { structures: [['PDS', 3]] } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 1 linkship, 3 PDS structures → 1 SC dice group
    expect(pool.defender.LINKSHIP_1).toHaveLength(1)
  })

  it('uses best SC source first then falls back', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 2, SPACE_DOCK: 1 },
        abilities: {
          LINKSHIP_1: {
            structures: [
              ['PDS', 1],
              ['SPACE_DOCK', 1],
            ],
          },
          LIGHTRAIL_ORDNANCE: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 2 linkships: first uses Space Dock [5, 2], second uses PDS [6, 1]
    expect(pool.defender.LINKSHIP_1).toHaveLength(2)
    expect(pool.defender).toContainDice('LINKSHIP_1', [5, 2])
    expect(pool.defender).toContainDice('LINKSHIP_1', [6, 1])
  })

  it('works without structures in the units list', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1 },
        abilities: { LINKSHIP_1: { structures: [['PDS', 1]] } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // No PDS in units list, but SC value derived from faction config
    expect(pool.defender.LINKSHIP_1).toHaveLength(1)
    expect(pool.defender).toContainDice('LINKSHIP_1', [6, 1])
  })

  it('uses best SC source among structures', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1, SPACE_DOCK: 1 },
        abilities: {
          LINKSHIP_1: { structures: [['SPACE_DOCK', 1]] },
          LIGHTRAIL_ORDNANCE: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Linkship uses Space Dock's SC [5, 2] (better than PDS [6, 1])
    expect(pool.defender).toContainDice('LINKSHIP_1', [5, 2])
  })
})
