import { runScenario } from './run-scenario'

const TYPES: ReadonlyArray<{ short: string; count: number }> = [
  { short: 'Fl', count: 1 },
  { short: 'W', count: 2 },
  { short: 'D', count: 2 },
  { short: 'Ca', count: 2 },
  { short: 'Cr', count: 2 },
  { short: 'De', count: 2 },
  { short: 'F', count: 2 },
  { short: 'PDS', count: 2 },
]

function buildSets(): string[] {
  const result: string[] = []
  const total = 1 << TYPES.length
  for (let mask = 1; mask < total; mask++) {
    const parts: string[] = []
    for (let i = 0; i < TYPES.length; i++) {
      if (mask & (1 << i)) {
        const { short, count } = TYPES[i]
        parts.push(count > 1 ? `${count}${short}` : short)
      }
    }
    result.push(parts.join(', '))
  }
  return result
}

const sets = buildSets()

describe('space combat — all units sets', () => {
  it.each(sets.map(set => [set, set]))('%s vs %s', (attacker, defender) => {
    expect(runScenario('SPACE', attacker, defender)).toMatchSnapshot()
  })
})
