import { describe, expect, it } from 'vitest'

import type { StateWithProbability } from '@/combat'
import type { CombatSide } from '@/types'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// Proxima emits two synthetic Bombardment 8 (×3) rolls per round, both rolled
// by the Bastion firer: the opp-bomb (default routing, hits land on the
// opponent) and the self-bomb (target=OWN, hits routed back to the firer via
// `_swapHitPools`). pendingSteps execute LIFO, so the opp-bomb (pushed second)
// resolves first and the self-bomb second. Bomb dice: 3 INF at hit value 8
// (faces 8-10 hit) → per-die p = 0.3; both rolls produce hits on the natural
// opponent (defender's pool) at the dice-roll branch, so distributions below
// are keyed by `pendingHits('defender')`.
//
// Heart of Ixth is a conditional result modifier. Because the self-bomb swaps
// attacker/defender, a conditional only lands on a bomb when it works in its
// owner's favour there: a +1 on the roll whose hits hurt the opponent, a -1 on
// the roll whose hits would hurt the owner. The engine routes each Heart config
// to exactly one of the two bombs (swapping the targeted side on the self-bomb)
// and leaves the other natural. Heart is given uses:2 so a bomb COULD fire
// twice if reached; the "natural" assertions show uses untouched at 2, proving
// the modifier was routed away rather than merely depleted.

// (defender hits, Heart uses remaining) grids for a 3-die bomb.
type Grid = { value: [number, number]; probability: number }[]

const NATURAL: Grid = [
  { value: [0, 2], probability: 0.343 },
  { value: [1, 2], probability: 0.441 },
  { value: [2, 2], probability: 0.189 },
  { value: [3, 2], probability: 0.027 },
]

// +1 flips up to two face-7 misses into hits (one use per flip).
const PLUS_ONE: Grid = [
  { value: [0, 2], probability: 0.216 },
  { value: [1, 1], probability: 0.108 },
  { value: [2, 0], probability: 0.019 },
  { value: [1, 2], probability: 0.324 },
  { value: [2, 1], probability: 0.108 },
  { value: [3, 0], probability: 0.009 },
  { value: [2, 2], probability: 0.162 },
  { value: [3, 1], probability: 0.027 },
  { value: [3, 2], probability: 0.027 },
]

// -1 flips up to two face-8 hits into misses (one use per flip).
const MINUS_ONE: Grid = [
  { value: [0, 2], probability: 0.343 },
  { value: [1, 2], probability: 0.294 },
  { value: [2, 2], probability: 0.084 },
  { value: [3, 2], probability: 0.008 },
  { value: [0, 1], probability: 0.147 },
  { value: [1, 1], probability: 0.084 },
  { value: [2, 1], probability: 0.012 },
  { value: [0, 0], probability: 0.021 },
  { value: [1, 0], probability: 0.007 },
]

function setup(owner: CombatSide, target: 'own' | 'opponent') {
  const heart = { HEART_OF_IXTH: { isEnabled: true, uses: 2, target } }
  return combatTest({
    mode: 'GROUND',
    attacker: {
      faction: 'LAST_BASTION',
      units: { INFANTRY: 3 },
      abilities: {
        PROXIMA_TARGETING_VI: { isEnabled: true, resolveBombardment: true },
        ...(owner === 'attacker' ? heart : {}),
      },
    },
    defender: {
      faction: 'ARBOREC',
      units: { INFANTRY: 3 },
      ...(owner === 'defender' ? { abilities: heart } : {}),
    },
  })
}

const grid = (owner: CombatSide) =>
  all(pendingHits('defender'), currentUses(owner, 'HEART_OF_IXTH'))

// Walk from the opp-bomb into the self-bomb via a branch where the opp-bomb
// produced 0 hits and left both uses intact, so the self-bomb is reached with
// full budget — any modifier present there is the routing under test, not a
// leftover from a depleted use.
function selfBomb(
  oppBranches: StateWithProbability[],
  owner: CombatSide,
): StateWithProbability[] {
  const intact = oppBranches.find(
    b =>
      pendingHits('defender')(b) === 0 &&
      currentUses(owner, 'HEART_OF_IXTH')(b) === 2,
  )!
  return intact.state.advance()
}

describe('HEART_OF_IXTH + PROXIMA_TARGETING_VI', () => {
  it("Bastion's +1 (own) routes to the opp-bomb, leaving the self-bomb natural", () => {
    const t = setup('attacker', 'own')
    const opp = t.advance()
    expect(opp).toHaveBranches(grid('attacker'), PLUS_ONE)
    expect(selfBomb(opp, 'attacker')).toHaveBranches(grid('attacker'), NATURAL)
  })

  it("Bastion's -1 (opponent) routes to the self-bomb, leaving the opp-bomb natural", () => {
    const t = setup('attacker', 'opponent')
    const opp = t.advance()
    expect(opp).toHaveBranches(grid('attacker'), NATURAL)
    expect(selfBomb(opp, 'attacker')).toHaveBranches(
      grid('attacker'),
      MINUS_ONE,
    )
  })

  it("opponent's +1 (own) routes to the self-bomb (vs Bastion), leaving the opp-bomb natural", () => {
    const t = setup('defender', 'own')
    const opp = t.advance()
    expect(opp).toHaveBranches(grid('defender'), NATURAL)
    expect(selfBomb(opp, 'defender')).toHaveBranches(grid('defender'), PLUS_ONE)
  })

  it("opponent's -1 (opponent) routes to the opp-bomb, leaving the self-bomb natural", () => {
    const t = setup('defender', 'opponent')
    const opp = t.advance()
    expect(opp).toHaveBranches(grid('defender'), MINUS_ONE)
    expect(selfBomb(opp, 'defender')).toHaveBranches(grid('defender'), NATURAL)
  })
})
