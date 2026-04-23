import { describe, expect, it } from 'vitest'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

/**
 * Engine test: verify that ability mutations during ASSIGN_HITS in one
 * dice-roll branch don't leak into other branches via shared state.
 *
 * Direct Hit calls destroyUnits → removeUnits which mutates the units array
 * in-place (splice). Since cloneStateForBranch shares the units object
 * between branches, this mutation affects all branches.
 */
describe('engine: branch isolation', () => {
  it('Direct Hit does not kill units in branches where it was not called', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceToTiming('ANNOUNCE_RETREAT_STEP')

    // Dice roll produces multiple branches (different hit combinations)
    const branches = t.step()
    expect(branches.length).toBeGreaterThan(1)

    // Helper: extract dice hits from a branch's log
    const getDiceHits = (log: (typeof branches)[0]['state']['log']) => {
      if (!log) return undefined
      for (let i = log.length - 1; i >= 0; i--) {
        const entry = log[i]
        if (entry.path.at(-1) === 'DICE_HITS' && entry.data) {
          return entry.data[0] as { attacker: number; defender: number }
        }
      }
      return undefined
    }

    // Find branch where defender receives a hit (sustain → Direct Hit fires)
    const hitBranch = branches.find(b => {
      const hits = getDiceHits(b.state.log)
      return hits !== undefined && hits.defender > 0
    })!
    expect(hitBranch).toBeDefined()

    // Find branch where defender receives no hit (Direct Hit should NOT fire)
    const noHitBranch = branches.find(b => {
      const hits = getDiceHits(b.state.log)
      return hits !== undefined && hits.defender === 0
    })!
    expect(noHitBranch).toBeDefined()

    expect(
      unitsByBaseType(noHitBranch.state.data.defender).DREADNOUGHT,
    ).toBeDefined()
    expect(
      unitsByBaseType(noHitBranch.state.data.defender).DREADNOUGHT!.length,
    ).toBe(1)

    // Process the hit branch through ASSIGN_HITS first.
    // This triggers: sustain damage → Direct Hit → destroyUnits → removeUnits
    // removeUnits splices the shared units array, contaminating other branches.
    // advance() is step-atomic; drive until the ASSIGN_HITS micro completes.
    {
      let s = hitBranch.state
      while (!s.isFinished() && s.pendingSteps.length > 0) {
        const top = s.peekStep()
        if (!top) break
        if (top.phase[top.phase.length - 1] !== 'SPACE_COMBAT') break
        const outcomes = s.advance(true)
        if (outcomes.length !== 1 || outcomes[0].probability !== 1) break
        s = outcomes[0].state
      }
      hitBranch.state = s
    }

    const directHitUses = (s: (typeof hitBranch)['state']) =>
      (s.data.liveAbilities.attacker['DIRECT_HIT']?.uses ??
        s.data.abilities.attacker['DIRECT_HIT']?.uses) as number

    expect(directHitUses(hitBranch.state)).toBe(0)

    // The no-hit branch should still have the defender's dreadnought.
    // BUG: removeUnits mutated the shared units object via splice,
    // so the dreadnought is gone from ALL branches.
    expect(directHitUses(noHitBranch.state)).toBe(1)
    expect(
      unitsByBaseType(noHitBranch.state.data.defender).DREADNOUGHT,
    ).toBeDefined()
    expect(
      unitsByBaseType(noHitBranch.state.data.defender).DREADNOUGHT!.length,
    ).toBe(1)
  })
})
