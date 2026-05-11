import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('WAR_FUNDING', () => {
  it('fires when at least one strategy says yes (ALWAYS / ALWAYS)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 1 },
        abilities: {
          WAR_FUNDING: {
            isEnabled: true,
            ownStrategy: { kind: 'ALWAYS' },
            opponentStrategy: { kind: 'ALWAYS' },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const rerollEntries = t
      .abilityLog('WAR_FUNDING')
      .filter(e => e.path.includes('REROLL_DICE_ROLL'))
    expect(rerollEntries).not.toHaveLength(0)
  })

  it('does not fire when both strategies are NEVER', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 1 },
        abilities: {
          WAR_FUNDING: {
            isEnabled: true,
            ownStrategy: { kind: 'NEVER' },
            opponentStrategy: { kind: 'NEVER' },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const rerollEntries = t
      .abilityLog('WAR_FUNDING')
      .filter(e => e.path.includes('REROLL_DICE_ROLL'))
    expect(rerollEntries).toHaveLength(0)
  })

  it('one-shot: uses=1 consumed after firing', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 2 },
        abilities: {
          WAR_FUNDING: {
            isEnabled: true,
            ownStrategy: { kind: 'ALWAYS' },
            opponentStrategy: { kind: 'NEVER' },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 5 } },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    // uses lives on liveAbilities overlay after decrement
    const live = t.state.attacker.liveAbilities.WAR_FUNDING as
      | { uses?: number }
      | undefined
    expect(live?.uses).toBe(0)
  })

  it('does not fire in GROUND combat (context: SPACE)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 1 },
        abilities: {
          WAR_FUNDING: {
            isEnabled: true,
            ownStrategy: { kind: 'ALWAYS' },
            opponentStrategy: { kind: 'ALWAYS' },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })
    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const rerollEntries = t
      .abilityLog('WAR_FUNDING')
      .filter(e => e.path.includes('REROLL_DICE_ROLL'))
    expect(rerollEntries).toHaveLength(0)
  })
})
