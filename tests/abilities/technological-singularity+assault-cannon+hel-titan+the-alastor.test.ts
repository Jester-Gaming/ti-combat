import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY + ASSAULT_CANNON + HEL_TITAN + THE_ALASTOR', () => {
  it('AC → Alastor: Hel Titan participates after TS enables it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 2, PDS: 1 },
        abilities: {
          ASSAULT_CANNON: true,
          TECHNOLOGICAL_SINGULARITY: {
            enableAbilityKey: 'NEKRO_UNIT_TITANS_OF_UL_PDS',
          },
          ABILITY_ORDER: {
            startOfCombat: [['ASSAULT_CANNON'], ['THE_ALASTOR']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    // AC fires → destroys defender cruiser → TS enables Hel Titan →
    // Alastor adds ground forces (now including PDS) to ships
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 0 })

    expect(t.defender.units.CRUISER).toHaveLength(2) // 3 - 1 from AC
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    const pool = t.dicePool()
    // Hel Titan II: COMBAT [6, 1] — should participate as a ship
    expect(pool.attacker).toContainDice('PDS', [6, 1])
  })

  it('Alastor → AC: Hel Titan does NOT participate', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 2, PDS: 1 },
        abilities: {
          ASSAULT_CANNON: true,
          TECHNOLOGICAL_SINGULARITY: {
            enableAbilityKey: 'NEKRO_UNIT_TITANS_OF_UL_PDS',
          },
          ABILITY_ORDER: {
            startOfCombat: [['THE_ALASTOR'], ['ASSAULT_CANNON']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    // Alastor fires first → PDS not yet a ground force →
    // AC fires → destroys cruiser → TS enables Hel Titan (but Alastor already ran)
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 0 })

    expect(t.defender.units.CRUISER).toHaveLength(2) // 3 - 1 from AC
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    const pool = t.dicePool()
    // PDS should NOT participate — Alastor already ran before Hel Titan was enabled
    expect(pool.attacker.PDS).toBeUndefined()
  })
})
