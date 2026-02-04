import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ASSAULT_CANNON + THE_ALASTOR', () => {
  it('destroys Alastor before it activates when Nekro is defender', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { ASSAULT_CANNON: true },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
    })

    // Attacker goes first in alternation: Assault Cannon fires
    // before Alastor, destroying the Flagship.
    // Alastor can't fire (unit destroyed), so infantry doesn't
    // participate — combat ends with no defender ships.
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.state.currentPhase.meta).toBe('COMPLETE')
    expect(t.defender.units.FLAGSHIP).toBeUndefined()
  })

  it('Alastor activates first when Nekro is attacker, infantry survives', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { ASSAULT_CANNON: true },
      },
    })

    // Attacker (Nekro) goes first: Alastor fires, infantry
    // participates. Then defender's Assault Cannon fires,
    // destroying the Flagship. But infantry is already in
    // space combat, so combat continues.
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    expect(t.state.currentPhase.meta).not.toBe('COMPLETE')
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.attacker.units.INFANTRY).toHaveLength(2)

    // Infantry can roll dice in combat
    const pool = t.dicePool()!
    // Infantry: [8, 1] per unit
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
  })
})
