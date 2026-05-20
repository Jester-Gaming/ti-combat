import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

const AMOUNT_OWN_LE0 = {
  ownStrategyKind: 'IF_HITS_AMOUNT_LE' as const,
  ownStrategyThreshold: 0,
  opponentStrategyKind: 'NEVER' as const,
  opponentStrategyThreshold: 0,
}

const AMOUNT_OPP_GE1 = {
  ownStrategyKind: 'NEVER' as const,
  ownStrategyThreshold: 0,
  opponentStrategyKind: 'IF_HITS_AMOUNT_GE' as const,
  opponentStrategyThreshold: 1,
}

describe('THUNDARIAN', () => {
  it('disabled: never restarts', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { THUNDARIAN: { isEnabled: false, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('THUNDARIAN')).toHaveLength(0)
  })

  it('own strategy fires on a bad own roll, spends the use', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          THUNDARIAN: {
            isEnabled: true,
            uses: 1,
            combinator: 'OR',
            ...AMOUNT_OWN_LE0,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 0 })

    expect(t.abilityLog('THUNDARIAN').length).toBeGreaterThan(0)
    expect(t.state.attacker.abilities.THUNDARIAN.uses).toBe(0)
  })

  it('own strategy does not fire on a good own roll, keeps the use', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          THUNDARIAN: {
            isEnabled: true,
            uses: 1,
            combinator: 'OR',
            ...AMOUNT_OWN_LE0,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 2 })

    expect(t.abilityLog('THUNDARIAN')).toHaveLength(0)
    expect(t.state.attacker.abilities.THUNDARIAN.uses).toBe(1)
  })

  it('opponent strategy fires on a dangerous opponent roll', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          THUNDARIAN: {
            isEnabled: true,
            uses: 1,
            combinator: 'OR',
            ...AMOUNT_OPP_GE1,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('THUNDARIAN').length).toBeGreaterThan(0)
  })

  it('opponent strategy does not fire on a weak opponent roll', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          THUNDARIAN: {
            isEnabled: true,
            uses: 1,
            combinator: 'OR',
            ...AMOUNT_OPP_GE1,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0 })

    expect(t.abilityLog('THUNDARIAN')).toHaveLength(0)
  })

  it('AND combinator requires both conditions', () => {
    const config = {
      isEnabled: true,
      uses: 1,
      combinator: 'AND' as const,
      ownStrategyKind: 'IF_HITS_AMOUNT_LE' as const,
      ownStrategyThreshold: 0,
      opponentStrategyKind: 'IF_HITS_AMOUNT_GE' as const,
      opponentStrategyThreshold: 1,
    }

    const both = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { THUNDARIAN: config },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })
    both.advanceTo('SPACE_COMBAT')
    both.advanceRound({ defender: 0, attacker: 1 })
    expect(both.abilityLog('THUNDARIAN').length).toBeGreaterThan(0)

    // Only own condition holds (own produces 0, opponent produces 0): AND fails.
    const ownConditionOnly = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { THUNDARIAN: config },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })
    ownConditionOnly.advanceTo('SPACE_COMBAT')
    ownConditionOnly.advanceRound({ defender: 0, attacker: 0 })
    expect(ownConditionOnly.abilityLog('THUNDARIAN')).toHaveLength(0)

    // Only opponent condition holds (own produces 2, opponent produces 1): AND fails.
    const opponentConditionOnly = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { THUNDARIAN: config },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })
    opponentConditionOnly.advanceTo('SPACE_COMBAT')
    opponentConditionOnly.advanceRound({ defender: 2, attacker: 1 })
    expect(opponentConditionOnly.abilityLog('THUNDARIAN')).toHaveLength(0)
  })

  it('OR combinator fires when either condition holds', () => {
    const config = {
      isEnabled: true,
      uses: 1,
      combinator: 'OR' as const,
      ownStrategyKind: 'IF_HITS_AMOUNT_LE' as const,
      ownStrategyThreshold: 0,
      opponentStrategyKind: 'IF_HITS_AMOUNT_GE' as const,
      opponentStrategyThreshold: 1,
    }

    const onlyOpp = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { THUNDARIAN: config },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })
    onlyOpp.advanceTo('SPACE_COMBAT')
    onlyOpp.advanceRound({ defender: 2, attacker: 1 })
    expect(onlyOpp.abilityLog('THUNDARIAN').length).toBeGreaterThan(0)

    const neither = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { THUNDARIAN: config },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })
    neither.advanceTo('SPACE_COMBAT')
    neither.advanceRound({ defender: 2, attacker: 0 })
    expect(neither.abilityLog('THUNDARIAN')).toHaveLength(0)
  })

  it('default percent config restarts a below-median own roll only', () => {
    const fires = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { THUNDARIAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })
    fires.advanceTo('SPACE_COMBAT')
    fires.advanceRound({ defender: 0 })
    expect(fires.abilityLog('THUNDARIAN').length).toBeGreaterThan(0)

    const quiet = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { THUNDARIAN: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })
    quiet.advanceTo('SPACE_COMBAT')
    quiet.advanceRound({ defender: 1 })
    expect(quiet.abilityLog('THUNDARIAN')).toHaveLength(0)
  })
})
