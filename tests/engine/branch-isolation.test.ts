import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

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

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

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
    const defenderUnits = noHitBranch.state.data.defender.units

    expect(noHitBranch).toBeDefined()

    expect(defenderUnits['DREADNOUGHT']).toBeDefined()
    expect(defenderUnits['DREADNOUGHT'].length).toBe(1)

    // Process the hit branch through ASSIGN_HITS first.
    // This triggers: sustain damage → Direct Hit → destroyUnits → removeUnits
    // removeUnits splices the shared units array, contaminating other branches.
    hitBranch.state.advance(1, true)

    expect(hitBranch.state.abilities.attacker.DIRECT_HIT.uses).toBe(0)

    // The no-hit branch should still have the defender's dreadnought.
    // BUG: removeUnits mutated the shared units object via splice,
    // so the dreadnought is gone from ALL branches.
    expect(noHitBranch.state.abilities.attacker.DIRECT_HIT.uses).toBe(1)
    expect(defenderUnits['DREADNOUGHT']).toBeDefined()
    expect(defenderUnits['DREADNOUGHT'].length).toBe(1)
  })
})
