import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSAIL', () => {
  it('applies +1 to combat rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'OBSIDIAN',
        units: { CRUISER: 1 },
        abilities: { ASSAIL: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser base: [7, 1], Assail -1 hit value = [6, 1]
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })

  it('applies +1 to AFB rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'OBSIDIAN',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: { ASSAIL: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1, CRUISER: 1 },
      },
    })

    // AFB dice pool is logged during AFB phase
    t.advanceTo('AFB', 'ASSIGN_HITS')
    const pool = t.dicePool()

    // Destroyer AFB base: [9, 2], Assail -1 = [8, 2]
    expect(pool.attacker).toContainDice('DESTROYER', [8, 2])
  })

  it('applies +1 to bombardment rolls', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'OBSIDIAN',
        units: { DREADNOUGHT: 1 },
        abilities: { ASSAIL: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Dreadnought bombardment base: [5, 1], Assail -1 = [4, 1]
    expect(pool.attacker).toContainDice('DREADNOUGHT', [4, 1])
  })

  it('applies +1 to space cannon offense rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'OBSIDIAN',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { ASSAIL: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    const pool = t.dicePool()

    // PDS space cannon base: [6, 1], Assail -1 = [5, 1]
    expect(pool.defender).toContainDice('PDS', [5, 1])
  })

  it('applies +1 to ground combat rolls', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'OBSIDIAN',
        units: { INFANTRY: 1 },
        abilities: { ASSAIL: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry base: [8, 1], Assail -1 = [7, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
  })

  it('does not modify opponent rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'OBSIDIAN',
        units: { CRUISER: 1 },
        abilities: { ASSAIL: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Defender cruiser should remain at base value [7, 1]
    expect(pool.defender).toContainDice('CRUISER', [7, 1])
  })
})
