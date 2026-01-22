import { CombatEngine } from './CombatEngine'
import { flattenTree } from '../probability'
import type { UnitStats } from '@/types'

const cruiserStats: UnitStats = { COMBAT: [7, 1], ABILITIES: {} }

function benchmark(name: string, fn: () => void): void {
  const start = performance.now()
  fn()
  const end = performance.now()
  console.log(`${name}: ${(end - start).toFixed(2)}ms`)
}

console.log('Performance benchmarks:')
console.log('========================')

benchmark('6v6 cruisers', () => {
  const engine = new CombatEngine({ maxRounds: 10 })
  const tree = engine.simulate(
    { CRUISER: cruiserStats },
    { CRUISER: 6 },
    { CRUISER: cruiserStats },
    { CRUISER: 6 },
  )
  const outcomes = flattenTree(tree)
  console.log(`  Outcomes: ${outcomes.length}`)
})

benchmark('10v10 cruisers', () => {
  const engine = new CombatEngine({ maxRounds: 10 })
  const tree = engine.simulate(
    { CRUISER: cruiserStats },
    { CRUISER: 10 },
    { CRUISER: cruiserStats },
    { CRUISER: 10 },
  )
  const outcomes = flattenTree(tree)
  console.log(`  Outcomes: ${outcomes.length}`)
})

benchmark('20v20 cruisers', () => {
  const engine = new CombatEngine({ maxRounds: 10 })
  const tree = engine.simulate(
    { CRUISER: cruiserStats },
    { CRUISER: 20 },
    { CRUISER: cruiserStats },
    { CRUISER: 20 },
  )
  const outcomes = flattenTree(tree)
  console.log(`  Outcomes: ${outcomes.length}`)
})

console.log('\nWith pruning disabled (exact calculation):')
console.log('==========================================')
console.log('(Note: Large fleets without pruning cause memory exhaustion)')

benchmark('3v3 cruisers (exact)', () => {
  const engine = new CombatEngine({ maxRounds: 10 })
  const tree = engine.simulate(
    { CRUISER: cruiserStats },
    { CRUISER: 3 },
    { CRUISER: cruiserStats },
    { CRUISER: 3 },
  )
  const outcomes = flattenTree(tree)
  const total = outcomes.reduce((s, o) => s + o.probability, 0)
  console.log(`  Outcomes: ${outcomes.length}, Total prob: ${total.toFixed(6)}`)
})

benchmark('4v4 cruisers (exact)', () => {
  const engine = new CombatEngine({ maxRounds: 10 })
  const tree = engine.simulate(
    { CRUISER: cruiserStats },
    { CRUISER: 4 },
    { CRUISER: cruiserStats },
    { CRUISER: 4 },
  )
  const outcomes = flattenTree(tree)
  const total = outcomes.reduce((s, o) => s + o.probability, 0)
  console.log(`  Outcomes: ${outcomes.length}, Total prob: ${total.toFixed(6)}`)
})
