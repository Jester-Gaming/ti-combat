import { writeFile } from 'node:fs/promises'
import { Session } from 'node:inspector/promises'

import { CombatEngine } from '@/combat/combat-engine'
import { createDefaultUnitSelections } from '@/combat/combat-side-state/combat-side-state'
import { CombatState } from '@/combat/combat-state/combat-state'
import type { SideStateData } from '@/combat/combat-state/types'
import type { FactionKey } from '@/types'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

const FACTION: FactionKey = 'ARBOREC'
const PROFILE_PATH = '/tmp/profile-50f-50f-no-abilities.cpuprofile'
const TOP_N = 25

function buildSideState(
  faction: FactionKey,
  fighterCount: number,
): SideStateData {
  const unitStats = buildUnitStatsMap(faction)
  return {
    faction,
    units: { FIGHTER: fighterCount },
    unitState: { FIGHTER: [] },
    unitStats: { FIGHTER: unitStats['FIGHTER'] },
    hitPools: [],
    unitSelections: createDefaultUnitSelections(),
  }
}

interface CPUProfileNode {
  id: number
  callFrame: {
    functionName: string
    url: string
    lineNumber: number
  }
}

interface CPUProfile {
  nodes: CPUProfileNode[]
  samples: number[]
}

function analyzeProfile(profile: CPUProfile) {
  const selfTime = new Map<number, number>()
  for (const id of profile.samples) {
    selfTime.set(id, (selfTime.get(id) || 0) + 1)
  }

  const funcSelf = new Map<string, number>()
  for (const n of profile.nodes) {
    const fn = n.callFrame
    const name = fn.functionName || '(anon)'
    const file = fn.url.replace(/.*\/src\//, 'src/')
    const key = `${name} @ ${file}:${fn.lineNumber + 1}`
    funcSelf.set(key, (funcSelf.get(key) || 0) + (selfTime.get(n.id) || 0))
  }

  const total = profile.samples.length
  const sorted = [...funcSelf.entries()].sort((a, b) => b[1] - a[1])

  console.info(`Total samples: ${total}\n`)
  console.info(`Top ${TOP_N} by SELF time:`)
  for (let i = 0; i < Math.min(TOP_N, sorted.length); i++) {
    const [key, self] = sorted[i]
    const selfPct = ((self / total) * 100).toFixed(1)
    console.info(
      `  ${selfPct.padStart(5)}%  ${String(self).padStart(5)}  ${key}`,
    )
  }
}

async function main() {
  const attacker = buildSideState(FACTION, 50)
  const defender = buildSideState(FACTION, 50)
  const state = CombatState.forSimulation(attacker, defender, 'SPACE')

  const session = new Session()
  session.connect()

  const originalDescriptor = Object.getOwnPropertyDescriptor(
    CombatState.prototype,
    'disableAbilities',
  )

  try {
    Object.defineProperty(CombatState.prototype, 'disableAbilities', {
      configurable: true,
      get() {
        return true
      },
    })

    await session.post('Profiler.enable')
    await session.post('Profiler.start')

    const t0 = performance.now()
    const engine = new CombatEngine()
    const results = engine.simulate(state)
    const elapsed = performance.now() - t0

    const stopResult = await session.post('Profiler.stop')

    console.info(
      `Simulation: ${elapsed.toFixed(1)}ms, ${results.length} outcomes\n`,
    )

    await writeFile(PROFILE_PATH, JSON.stringify(stopResult.profile))
    console.info(`Profile saved to ${PROFILE_PATH}\n`)

    analyzeProfile(stopResult.profile as unknown as CPUProfile)
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(
        CombatState.prototype,
        'disableAbilities',
        originalDescriptor,
      )
    }
    session.disconnect()
  }
}

main()
