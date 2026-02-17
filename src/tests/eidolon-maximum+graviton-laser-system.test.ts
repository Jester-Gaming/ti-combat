import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('EIDOLON_MAXIMUM + GRAVITON_LASER_SYSTEM', () => {
  it('mech is immune to SCO even when Graviton Laser restricts targets', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1, FIGHTER: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, PDS: 2 },
        abilities: { GRAVITON_LASER_SYSTEM: true },
      },
    })

    // Advance past SCO — attacker receives 2 hits
    // Graviton Laser restricts SCO to non-fighter ships,
    // so Fighter and Mech are both immune — only Cruiser can be hit
    t.advanceTo('AFB', undefined, { attacker: 2 })

    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
    expect(t.attacker.units.CRUISER).toBeUndefined()
  })
})
