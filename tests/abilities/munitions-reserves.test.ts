import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('MUNITIONS_RESERVES', () => {
  it('fires once per round when ALWAYS strategy is enabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 1 },
        abilities: {
          MUNITIONS_RESERVES: {
            isEnabled: true,
            uses: 1,
            ownStrategy: { kind: 'ALWAYS' },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 5 } },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    expect(t.abilityLog('MUNITIONS_RESERVES')).not.toHaveLength(0)
  })

  it('does not fire when disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 5 } },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    expect(t.abilityLog('MUNITIONS_RESERVES')).toHaveLength(0)
  })

  it('does not fire when NEVER strategy is set', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 1 },
        abilities: {
          MUNITIONS_RESERVES: {
            isEnabled: true,
            ownStrategy: { kind: 'NEVER' },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 5 } },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const rerollEntries = t
      .abilityLog('MUNITIONS_RESERVES')
      .filter(e => e.path.includes('REROLL_DICE_ROLL'))
    expect(rerollEntries).toHaveLength(0)
  })

  it('does not fire in GROUND combat (context: SPACE)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 2 },
        abilities: {
          MUNITIONS_RESERVES: {
            isEnabled: true,
            ownStrategy: { kind: 'ALWAYS' },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })
    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    expect(t.abilityLog('MUNITIONS_RESERVES')).toHaveLength(0)
  })

  it('IF_HITS_LE: fires only when own total hits ≤ threshold', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 2 },
        abilities: {
          MUNITIONS_RESERVES: {
            isEnabled: true,
            ownStrategy: { kind: 'IF_HITS_LE', threshold: 0 },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 5 } },
    })
    t.advanceTo('SPACE_COMBAT')
    // Pick the branch where the attacker rolled 2 hits — strategy says
    // "fire only if attacker hits ≤ 0", so this branch should NOT fire.
    t.advanceRound({ defender: 2 })
    const rerollEntries = t
      .abilityLog('MUNITIONS_RESERVES')
      .filter(e => e.path.includes('REROLL_DICE_ROLL'))
    expect(rerollEntries).toHaveLength(0)
  })
})
