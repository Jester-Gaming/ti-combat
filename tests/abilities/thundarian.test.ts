import { describe, expect, it } from 'vitest'

import { branchesByHit, sumProb } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('THUNDARIAN', () => {
  it('disabled: produces baseline binomial distribution', () => {
    // 2 attacker cruisers [7,1] vs 1 defender carrier (no combat dice).
    // Per attacker die: hit (face 7-10) = 0.4, miss = 0.6.
    // P(0 hits) = 0.36, P(1 hit) = 0.48, P(2 hits) = 0.16.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          THUNDARIAN: { isEnabled: false, uses: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'SPACE_COMBAT')
    const branches = t.step()

    expect(sumProb(branches)).toBeCloseTo(1, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 0))).toBeCloseTo(0.36, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 1))).toBeCloseTo(0.48, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 2))).toBeCloseTo(0.16, 8)
  })

  it('enabled (uses=1): restart fires, hits discarded, fresh roll committed', () => {
    // With Thundarian enabled on attacker (uses=1), the FIRST dice-roll
    // group's hits are discarded and a fresh group runs. Since the re-roll
    // is an independent Bernoulli sample with the same distribution, the
    // final hit distribution on the defender is the same as the baseline
    // binomial. Verify the ability fired and its uses went to 0.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          THUNDARIAN: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('THUNDARIAN')).not.toHaveLength(0)
    // After one fire, Thundarian is exhausted.
    expect(t.state.attacker.abilities.THUNDARIAN.uses).toBe(0)

    // Check the RESTART log event was emitted at least once.
    const restarts = t.log.filter(e => e.path.includes('RESTART'))
    expect(restarts).not.toHaveLength(0)
  })

  it('exhausts after one fire: uses goes 1 → 0 after combat round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          THUNDARIAN: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('THUNDARIAN')).not.toHaveLength(0)
    expect(t.state.attacker.abilities.THUNDARIAN.uses).toBe(0)
  })

  it('uses=0: does not fire, dice roll commits normally', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          THUNDARIAN: { isEnabled: true, uses: 0 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'SPACE_COMBAT')
    const branches = t.step()

    expect(sumProb(branches)).toBeCloseTo(1, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 0))).toBeCloseTo(0.36, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 1))).toBeCloseTo(0.48, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 2))).toBeCloseTo(0.16, 8)
    expect(t.abilityLog('THUNDARIAN')).toHaveLength(0)
  })

  it('fires in round 1, exhausted in round 2 — round 2 produces baseline', () => {
    // Use 2 cruisers vs 1 carrier — defender has no combat dice, so attacker
    // cruisers never die. Round 1: Thundarian fires (uses 1 → 0). Round 2:
    // Thundarian has uses=0, doesn't fire, dice commit normally.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          THUNDARIAN: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound() // round 1: Thundarian fires once

    expect(t.abilityLog('THUNDARIAN')).not.toHaveLength(0)
    expect(t.state.attacker.abilities.THUNDARIAN.uses).toBe(0)

    const round1LogCount = t.abilityLog('THUNDARIAN').length

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'SPACE_COMBAT')
    const branches = t.step()

    expect(sumProb(branches)).toBeCloseTo(1, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 0))).toBeCloseTo(0.36, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 1))).toBeCloseTo(0.48, 8)
    expect(sumProb(branchesByHit(branches, 'defender', 2))).toBeCloseTo(0.16, 8)

    // Round 2 didn't add restart entries.
    expect(t.abilityLog('THUNDARIAN').length).toBe(round1LogCount)
  })
})
