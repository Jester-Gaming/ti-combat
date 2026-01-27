import { describe, expect, it } from 'vitest'

import {
  getInitialPhaseIdentifier,
  getNextMetaPhase,
  getNextMicroPhase,
  getNextPhaseIdentifier,
} from './phase-utils'
import type { PhaseIdentifier } from './types'

describe('Two-tier phase system', () => {
  describe('getInitialPhaseIdentifier', () => {
    it('returns SPACE_CANNON_OFFENSE:START for SPACE mode', () => {
      const phase = getInitialPhaseIdentifier('SPACE')
      expect(phase).toEqual({ meta: 'SPACE_CANNON_OFFENSE', micro: 'START' })
    })

    it('returns BOMBARDMENT:START for GROUND mode', () => {
      const phase = getInitialPhaseIdentifier('GROUND')
      expect(phase).toEqual({ meta: 'BOMBARDMENT', micro: 'START' })
    })
  })

  describe('getNextMicroPhase', () => {
    it('transitions DICE_ROLL -> ASSIGN_HITS', () => {
      const current: PhaseIdentifier = {
        meta: 'SPACE_COMBAT',
        micro: 'DICE_ROLL',
      }
      const result = getNextMicroPhase(current)
      expect(result.phase.micro).toBe('ASSIGN_HITS')
    })

    it('transitions ASSIGN_HITS -> END', () => {
      const current: PhaseIdentifier = {
        meta: 'SPACE_COMBAT',
        micro: 'ASSIGN_HITS',
      }
      const result = getNextMicroPhase(current)
      expect(result.phase.micro).toBe('END')
    })

    it('stays at END when already at END', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'END' }
      const result = getNextMicroPhase(current)
      expect(result.phase.micro).toBe('END')
    })

    it('transitions AFB -> DICE_ROLL', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'AFB' }
      const result = getNextMicroPhase(current)
      expect(result.phase.micro).toBe('DICE_ROLL')
    })
  })

  describe('AFB micro-phase (round-dependent)', () => {
    it('transitions START -> AFB in SPACE_COMBAT round 1', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'START' }
      const result = getNextMicroPhase(current, 1)
      expect(result.phase.micro).toBe('AFB')
      expect(result.incrementRound).toBe(false)
    })

    it('skips AFB in SPACE_COMBAT round 2', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'START' }
      const result = getNextMicroPhase(current, 2)
      expect(result.phase.micro).toBe('DICE_ROLL')
    })

    it('skips AFB in SPACE_COMBAT round 3+', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'START' }
      const result = getNextMicroPhase(current, 5)
      expect(result.phase.micro).toBe('DICE_ROLL')
    })

    it('skips AFB in non-SPACE_COMBAT meta-phases (BOMBARDMENT)', () => {
      const current: PhaseIdentifier = { meta: 'BOMBARDMENT', micro: 'START' }
      const result = getNextMicroPhase(current, 1)
      expect(result.phase.micro).toBe('DICE_ROLL')
    })

    it('skips AFB in non-SPACE_COMBAT meta-phases (GROUND_COMBAT)', () => {
      const current: PhaseIdentifier = { meta: 'GROUND_COMBAT', micro: 'START' }
      const result = getNextMicroPhase(current, 1)
      expect(result.phase.micro).toBe('DICE_ROLL')
    })

    it('skips AFB in SPACE_CANNON_OFFENSE', () => {
      const current: PhaseIdentifier = {
        meta: 'SPACE_CANNON_OFFENSE',
        micro: 'START',
      }
      const result = getNextMicroPhase(current, 1)
      expect(result.phase.micro).toBe('DICE_ROLL')
    })

    it('defaults to round 1 when round not specified (backward compat)', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'START' }
      const result = getNextMicroPhase(current)
      expect(result.phase.micro).toBe('AFB')
    })
  })

  describe('getNextMetaPhase', () => {
    describe('SPACE mode flow', () => {
      it('transitions SPACE_CANNON_OFFENSE -> SPACE_COMBAT', () => {
        const current: PhaseIdentifier = {
          meta: 'SPACE_CANNON_OFFENSE',
          micro: 'END',
        }
        const result = getNextMetaPhase(current, 'SPACE')
        expect(result.phase.meta).toBe('SPACE_COMBAT')
        expect(result.phase.micro).toBe('START')
      })

      it('SPACE_COMBAT loops back with round increment', () => {
        const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'END' }
        const result = getNextMetaPhase(current, 'SPACE')
        expect(result.phase.meta).toBe('SPACE_COMBAT')
        expect(result.phase.micro).toBe('START')
        expect(result.incrementRound).toBe(true)
      })
    })

    describe('GROUND mode flow', () => {
      it('transitions BOMBARDMENT -> SPACE_CANNON_DEFENSE', () => {
        const current: PhaseIdentifier = { meta: 'BOMBARDMENT', micro: 'END' }
        const result = getNextMetaPhase(current, 'GROUND')
        expect(result.phase.meta).toBe('SPACE_CANNON_DEFENSE')
        expect(result.phase.micro).toBe('START')
      })

      it('transitions SPACE_CANNON_DEFENSE -> GROUND_COMBAT', () => {
        const current: PhaseIdentifier = {
          meta: 'SPACE_CANNON_DEFENSE',
          micro: 'END',
        }
        const result = getNextMetaPhase(current, 'GROUND')
        expect(result.phase.meta).toBe('GROUND_COMBAT')
        expect(result.phase.micro).toBe('START')
      })

      it('GROUND_COMBAT loops back with round increment', () => {
        const current: PhaseIdentifier = { meta: 'GROUND_COMBAT', micro: 'END' }
        const result = getNextMetaPhase(current, 'GROUND')
        expect(result.phase.meta).toBe('GROUND_COMBAT')
        expect(result.phase.micro).toBe('START')
        expect(result.incrementRound).toBe(true)
      })
    })

    describe('edge cases', () => {
      it('returns COMPLETE when already at COMPLETE', () => {
        const current: PhaseIdentifier = { meta: 'COMPLETE', micro: 'END' }
        const result = getNextMetaPhase(current, 'SPACE')
        expect(result.phase.meta).toBe('COMPLETE')
        expect(result.phase.micro).toBe('END')
        expect(result.incrementRound).toBe(false)
      })
    })
  })

  describe('getNextPhaseIdentifier', () => {
    it('delegates to getNextMicroPhase when not at END (round 1 with AFB)', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'START' }
      const result = getNextPhaseIdentifier(current, 'SPACE', 1)
      expect(result.phase.micro).toBe('AFB')
    })

    it('delegates to getNextMicroPhase when not at END (round 2 skips AFB)', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'START' }
      const result = getNextPhaseIdentifier(current, 'SPACE', 2)
      expect(result.phase.micro).toBe('DICE_ROLL')
    })

    it('delegates to getNextMetaPhase when at END', () => {
      const current: PhaseIdentifier = {
        meta: 'SPACE_CANNON_OFFENSE',
        micro: 'END',
      }
      const result = getNextPhaseIdentifier(current, 'SPACE')
      expect(result.phase.meta).toBe('SPACE_COMBAT')
      expect(result.phase.micro).toBe('START')
    })
  })
})
