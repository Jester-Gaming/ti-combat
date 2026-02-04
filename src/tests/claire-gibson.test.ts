import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('Claire Gibson', () => {
  it('places 1 infantry at start of ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { CLAIRE_GIBSON: { isEnabled: true } },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('CLAIRE_GIBSON')).toHaveLength(1)
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })

  it('does not fire when bombardment kills all defenders', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: { CLAIRE_GIBSON: { isEnabled: true } },
      },
    })

    // Bombardment: dreadnought [5, 1] — pick 1-hit branch to kill
    // the defender's only infantry
    t.advanceTo('COMPLETE', undefined, 1)

    expect(t.state.currentPhase.meta).toBe('COMPLETE')
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })

  it('does not fire when disabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { CLAIRE_GIBSON: { isEnabled: false } },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('CLAIRE_GIBSON')).toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('only fires for the defender', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { CLAIRE_GIBSON: { isEnabled: true } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    // Attacker should not gain infantry
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
