import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('RAISE_THE_STANDARD + SALVAGE_OPERATIONS', () => {
  it('placed ship can be galvanized', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { DREADNOUGHT: 2 },
        abilities: {
          SALVAGE_OPERATIONS: {
            isEnabled: true,
            shipPriority: ['CRUISER'],
          },
          RAISE_THE_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
          ABILITY_ORDER: {
            endOfCombat: ['SALVAGE_OPERATIONS', 'RAISE_THE_STANDARD'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.defender.units.CRUISER).toBeUndefined()
    // Salvage placed a cruiser (defender's cruiser was destroyed)
    expect(t.abilityLog('SALVAGE_OPERATIONS')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    // Raise the Standard galvanized the placed cruiser
    expect(t.abilityLog('RAISE_THE_STANDARD')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER![0].subtypes).toContain('Galvanized')
  })

  it('salvage still fires when raise galvanizes last ship first', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: {
          SALVAGE_OPERATIONS: {
            isEnabled: true,
            shipPriority: ['CRUISER'],
          },
          RAISE_THE_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: ['CRUISER'],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
          ABILITY_ORDER: {
            endOfCombat: ['RAISE_THE_STANDARD', 'SALVAGE_OPERATIONS'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Attacker loses 1 cruiser, defender eliminated
    t.advanceRound({ attacker: 1, defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.defender.units.CRUISER).toBeUndefined()
    // Raise fires first — galvanizes the surviving cruiser
    expect(t.abilityLog('RAISE_THE_STANDARD')).not.toHaveLength(0)
    // Salvage still fires despite last cruiser being galvanized
    expect(t.abilityLog('SALVAGE_OPERATIONS')).not.toHaveLength(0)
    // 1 surviving (galvanized) + 1 placed by Salvage = 2 cruisers
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })
})
