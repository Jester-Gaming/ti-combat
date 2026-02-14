import { useEffect, useRef, useState } from 'react'

import type { AbilitiesConfig, CombatMode } from '@/combat/combat-state/types'
import type { CombatOutcome } from '@/combat/types'
import type { FactionKey, UnitSelection, UnitType } from '@/types'

export interface SimulationInput {
  attackerFaction: FactionKey
  defenderFaction: FactionKey
  attackerSelections: Record<UnitType, UnitSelection>
  defenderSelections: Record<UnitType, UnitSelection>
  combatMode: CombatMode
  abilities: AbilitiesConfig
}

const DEBOUNCE_MS = 200

export function useSimulation(input: SimulationInput | null): {
  outcomes: CombatOutcome[] | null
  isComputing: boolean
} {
  const [state, setState] = useState<{
    outcomes: CombatOutcome[] | null
    forInput: SimulationInput | null
  }>({ outcomes: null, forInput: null })
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    if (input === null) {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      return
    }

    const timer = setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }

      const worker = new Worker(
        new URL('../combat/combat.worker.ts', import.meta.url),
        { type: 'module' },
      )

      worker.onmessage = (e: MessageEvent<CombatOutcome[]>) => {
        setState({ outcomes: e.data, forInput: input })
      }

      worker.postMessage(input)
      workerRef.current = worker
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [input])

  if (input === null) {
    return { outcomes: null, isComputing: false }
  }

  return {
    outcomes: state.outcomes,
    isComputing: state.forInput !== input,
  }
}
