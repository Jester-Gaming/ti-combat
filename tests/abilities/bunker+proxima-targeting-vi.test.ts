import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// NO_EXPLICIT_RULLING
// To be honest, I have no idea how it should work.
// -4 for both rolls sounds strange. But it matches card RAW.
describe('BUNKER + PROXIMA_TARGETING_VI', () => {
  it('Bunker on defender collapses Proxima rolls to a single outcome', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 6 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 6 },
        abilities: { BUNKER: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')

    expect(t.step()).toHaveLength(1)
  })

  it('Bunker on defender-Bastion blocks the self-target Proxima roll', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 6 },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 6 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
          BUNKER: true,
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')

    expect(t.step()).toHaveLength(1)
  })
})
