import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('CAVALRY + THE_ALASTOR', () => {
  it('both fire at START_OF_COMBAT: attacker Alastor then defender Cavalry', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('THE_ALASTOR')).not.toHaveLength(0)
    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)

    t.advanceRound()
    const pool = t.dicePool()

    // Attacker: Flagship [7, 2], Infantry [8, 1] x2
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1], [8, 1])

    // Defender: Cavalry Cruiser [7, 2], plain Cruiser [7, 1]
    expect(pool.defender).toContainDice('CRUISER', [7, 2], [7, 1])
  })

  it('Cavalry can target infantry made into a ship by The Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'INFANTRY' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('THE_ALASTOR')).not.toHaveLength(0)
    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)

    t.advanceRound()
    const pool = t.dicePool()

    // Flagship [9, 2], Cavalry Infantry [7, 2], plain Infantry [8, 1]
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
    expect(pool.attacker).toContainDice('INFANTRY', [7, 2], [8, 1])
  })
})
