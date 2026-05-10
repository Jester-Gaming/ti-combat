import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('HEL_TITAN + TECHNOLOGICAL_SINGULARITY + THE_ALASTOR', () => {
  it('TS-picked Hel Titan II propagates declarations at setup: PDS becomes a ground force, Alastor adds it to ships, Sustain Damage lists it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, PDS: 2, CRUISER: 1 },
        abilities: {
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'NEKRO_UNIT_TITANS_OF_UL_PDS',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    const sustain = t.state.attacker.abilities.SUSTAIN_DAMAGE as
      | { spacePriority?: [string, boolean][] }
      | undefined
    expect(sustain?.spacePriority?.map(([u]) => u)).toContain('PDS')
  })
})
