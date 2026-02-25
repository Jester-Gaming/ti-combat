import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// Both The Alastor and Dimensional Splicer fire at START_OF_COMBAT.
// Alastor makes ground forces into ships. If Alastor resolves before DS,
// DS could target infantry as ships.
describe('DIMENSIONAL_SPLICER + THE_ALASTOR', () => {
  it('DS targets infantry-as-ship after Alastor resolves first', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 3 },
      },
      defender: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 2 },
        abilities: {
          DIMENSIONAL_SPLICER: true,
        },
      },
    })

    // Alastor is attacker (resolves first in alternation),
    // DS is defender (resolves second)
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('THE_ALASTOR')).not.toHaveLength(0)
    expect(t.abilityLog('DIMENSIONAL_SPLICER')).not.toHaveLength(0)
    // DS hit assigned to one of attacker's units (infantry is now ship)
    const totalAttacker =
      (t.attacker.units.FLAGSHIP?.length ?? 0) +
      (t.attacker.units.INFANTRY?.length ?? 0)
    // 1 flagship + 3 infantry - 1 DS hit = 3
    expect(totalAttacker).toBe(3)
  })

  it('DS can target Alastor flagship directly', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 2 },
        abilities: {
          DIMENSIONAL_SPLICER: {
            isEnabled: true,
            targetPriority: ['FLAGSHIP'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // DS targets flagship -> sustains
    expect(t.abilityLog('DIMENSIONAL_SPLICER')).not.toHaveLength(0)
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })
})
