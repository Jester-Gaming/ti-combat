import type { UnitState } from '@/types'

export function stateDestroyScore(state: UnitState | undefined): number {
  if (!state) return 0
  if (state.isDamaged && state.usedSustainThisRound) {
    return 3
  }
  if (state.isDamaged) {
    return 2
  }
  if (state.usedSustainThisRound) {
    return 1
  }
  return 0
}
