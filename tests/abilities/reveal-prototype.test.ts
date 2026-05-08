import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('REVEAL_PROTOTYPE', () => {
  it('upgrades cruiser combat value in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            spacePriority: [['CRUISER', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: base [7, 1] -> upgraded [6, 1]
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
    expect(pool.defender).toContainDice('CRUISER', [7, 1])
    expect(t.abilityLog('REVEAL_PROTOTYPE')).not.toHaveLength(0)
  })

  it('upgrades infantry combat value in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            groundPriority: [['INFANTRY', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry: base [8, 1] -> upgraded [7, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
    expect(pool.defender).toContainDice('INFANTRY', [8, 1])
  })

  it('upgrades destroyer AFB when applied', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: {
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            spacePriority: [['DESTROYER', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 2 } },
    })

    t.advanceToTiming('ANNOUNCE_RETREAT_STEP')
    const pool = t.dicePool()

    // Destroyer AFB: base [9, 2] -> upgraded [6, 3]
    expect(pool.attacker).toContainDice('DESTROYER', [6, 3])
  })

  it('grants Direct Hit immunity after upgrading a dreadnought', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            spacePriority: [['DREADNOUGHT', true]],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Upgraded dreadnought sustains and is immune to Direct Hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('does not fire when the only participating type has no upgrade', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1 },
        abilities: {
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            spacePriority: [['WAR_SUN', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('REVEAL_PROTOTYPE')).toHaveLength(0)
  })

  it('does not fire when the type is already upgraded', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        upgrades: ['CRUISER'],
        abilities: {
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            spacePriority: [['CRUISER', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('REVEAL_PROTOTYPE')).toHaveLength(0)
  })

  it('falls through priority to the first eligible type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
        abilities: {
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            spacePriority: [
              ['CRUISER', true],
              ['FIGHTER', true],
              ['WAR_SUN', true],
            ],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: base [7, 1] -> upgraded [6, 1]
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
