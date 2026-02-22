import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ALASTOR + QUETZECOATL', () => {
  it('disables opponent space cannon', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { QUETZECOATL: true },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 1, CRUISER: 1 } },
    })

    t.advanceTo('AFB') // past SCO
    const pool = t.dicePool()

    // PDS space cannon disabled by Quetzecoatl
    expect(pool?.defender?.PDS).toBeUndefined()
  })
})
