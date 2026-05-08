import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LINKSHIP_2', () => {
  it('allows all linkships to fire using the same structure', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 3 },
        upgrades: ['DESTROYER'],
        abilities: { LINKSHIP_2: { structures: [['PDS', 1]] } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Linkship II: all 3 destroyers fire SC using the 1 PDS
    expect(pool.defender.DESTROYER).toHaveLength(3)
    expect(pool.defender).toContainDice('DESTROYER', [6, 1])
  })

  it('is capped by linkship count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1 },
        upgrades: ['DESTROYER'],
        abilities: { LINKSHIP_2: { structures: [['PDS', 3]] } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 1 linkship, 3 PDS structures → 1 SC dice group
    expect(pool.defender.DESTROYER).toHaveLength(1)
  })

  it('works without structures in the units list', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1 },
        upgrades: ['DESTROYER'],
        abilities: { LINKSHIP_2: { structures: [['PDS', 1]] } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // No PDS in units list, but SC value derived from faction config
    expect(pool.defender.DESTROYER).toHaveLength(1)
    expect(pool.defender).toContainDice('DESTROYER', [6, 1])
  })

  it('uses best SC source among structures', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1, SPACE_DOCK: 1 },
        upgrades: ['DESTROYER'],
        abilities: {
          LINKSHIP_2: { structures: [['SPACE_DOCK', 1]] },
          LIGHTRAIL_ORDNANCE: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Linkship uses Space Dock's SC [5, 2] (better than PDS [6, 1])
    expect(pool.defender).toContainDice('DESTROYER', [5, 2])
  })
})
