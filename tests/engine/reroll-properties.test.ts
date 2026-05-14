import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { CombatEngine } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

declare global {
  interface AbilityConfigMap {
    TEST_REROLL_MISSES_FAKE: Record<string, never>
    TEST_REROLL_ALL_FAKE: Record<string, never>
    TEST_DEFENDER_AUTO_MISS: Record<string, never>
  }
}

const rerollMissesFake: Ability = {
  key: 'TEST_REROLL_MISSES_FAKE',
  name: 'Test: reroll misses (once)',
  context: 'SPACE',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      call: ctx => {
        ctx.api.own.reroll({ target: 'MISSES' })
      },
    },
  ],
}

const rerollAllFake: Ability = {
  key: 'TEST_REROLL_ALL_FAKE',
  name: 'Test: reroll all (once)',
  context: 'SPACE',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      call: ctx => {
        ctx.api.own.reroll({ target: 'ALL' })
      },
    },
  ],
}

const defenderAutoMiss: Ability = {
  key: 'TEST_DEFENDER_AUTO_MISS',
  name: 'Test: defender auto-miss',
  side: 'defender',
  context: 'SPACE',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.applyBonusToResult(-10)
      },
    },
  ],
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i
  return r
}

function binomialPMF(n: number, p: number, k: number): number {
  return binomial(n, k) * p ** k * (1 - p) ** (n - k)
}

function countDefenderFighters(
  survivors: Record<string, { length: number }[]>,
): number {
  let n = 0
  for (const key of Object.keys(survivors)) {
    if (key === 'FIGHTER' || key.startsWith('FIGHTER:')) {
      const list = survivors[key]
      n += Array.isArray(list) ? list.length : 0
    }
  }
  return n
}

function attackerHitDistribution(
  attackerAbilities: Record<string, unknown>,
  customAbilities: Ability[],
  attackerCount = 10,
  defenderCount = 10,
): Map<number, number> {
  const state = buildCombatState({
    mode: 'SPACE',
    attacker: {
      faction: 'BARONY_OF_LETNEV',
      units: { FIGHTER: attackerCount },
      abilities: {
        RETREAT: { isEnabled: true, rounds: 1 },
        ...attackerAbilities,
      },
    },
    defender: {
      faction: 'ARBOREC',
      units: { FIGHTER: defenderCount },
      abilities: { TEST_DEFENDER_AUTO_MISS: true },
    },
    customAbilities,
  })
  const outcomes = new CombatEngine().simulate(state)

  const dist = new Map<number, number>()
  for (const o of outcomes) {
    const defAlive = countDefenderFighters(o.defender as never)
    const hits = defenderCount - defAlive
    dist.set(hits, (dist.get(hits) ?? 0) + o.probability)
  }
  return dist
}

describe('reroll engine outcome distributions', () => {
  it("reroll('ALL'): outcome distribution matches identical combat with no reroll", () => {
    const baseline = attackerHitDistribution({}, [defenderAutoMiss])
    const withReroll = attackerHitDistribution({ TEST_REROLL_ALL_FAKE: true }, [
      rerollAllFake,
      defenderAutoMiss,
    ])

    expect([...baseline.keys()].sort((a, b) => a - b)).toEqual(
      [...withReroll.keys()].sort((a, b) => a - b),
    )
    for (const k of baseline.keys()) {
      expect(withReroll.get(k)!).toBeCloseTo(baseline.get(k)!, 10)
    }
  })

  it("reroll('MISSES'): outcome distribution matches Binomial(10, p_eff)", () => {
    const n = 10
    const p = 0.2
    const pEff = p + (1 - p) * p
    const dist = attackerHitDistribution({ TEST_REROLL_MISSES_FAKE: true }, [
      rerollMissesFake,
      defenderAutoMiss,
    ])

    for (let k = 0; k <= n; k++) {
      const expected = binomialPMF(n, pEff, k)
      const observed = dist.get(k) ?? 0
      expect(observed).toBeCloseTo(expected, 8)
    }
  })
})
