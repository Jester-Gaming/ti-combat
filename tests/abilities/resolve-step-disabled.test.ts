import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('Disabled step abilities skip their dice roll', () => {
  it('SPACE_CANNON_OFFENSE disabled → no SCO DICE_POOL', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, PDS: 1 },
        abilities: { SPACE_CANNON_OFFENSE: { isEnabled: false } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, PDS: 1 },
        abilities: { SPACE_CANNON_OFFENSE: { isEnabled: false } },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    const scoDicePools = t.log
      .filter(e => e.path.includes('SPACE_CANNON_OFFENSE'))
      .filter(e => e.path[e.path.length - 1] === 'DICE_POOL')
    expect(scoDicePools).toHaveLength(0)
  })

  it('BOMBARDMENT disabled → no BOMBARDMENT DICE_POOL', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 2 },
        abilities: { BOMBARDMENT: { isEnabled: false } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    const bombDicePools = t.log
      .filter(e => e.path.includes('BOMBARDMENT'))
      .filter(e => e.path[e.path.length - 1] === 'DICE_POOL')
    expect(bombDicePools).toHaveLength(0)
  })

  it('SPACE_CANNON_DEFENSE disabled → no SCD DICE_POOL', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: { SPACE_CANNON_DEFENSE: { isEnabled: false } },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    const scdDicePools = t.log
      .filter(e => e.path.includes('SPACE_CANNON_DEFENSE'))
      .filter(e => e.path[e.path.length - 1] === 'DICE_POOL')
    expect(scdDicePools).toHaveLength(0)
  })

  it('SPACE_CANNON_DEFENSE only fires for defender side', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    const scdDicePools = t.log
      .filter(e => e.path.includes('SPACE_CANNON_DEFENSE'))
      .filter(e => e.path[e.path.length - 1] === 'DICE_POOL')
    expect(scdDicePools).toHaveLength(0)
  })
})
