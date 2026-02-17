import { describe, expect, it } from 'vitest'

import {
  getInitialPhaseIdentifier,
  getNextMetaPhase,
  getNextMicroPhase,
} from './phase-utils'
import type { PhaseIdentifier } from './types'

describe('Two-tier phase system', () => {
  describe('getInitialPhaseIdentifier', () => {
    it('returns SPACE_CANNON_OFFENSE:DICE_ROLL for SPACE mode', () => {
      const phase = getInitialPhaseIdentifier('SPACE')
      expect(phase).toEqual({
        meta: 'SPACE_CANNON_OFFENSE',
        micro: 'DICE_ROLL',
      })
    })

    it('returns BOMBARDMENT:DICE_ROLL for GROUND mode', () => {
      const phase = getInitialPhaseIdentifier('GROUND')
      expect(phase).toEqual({ meta: 'BOMBARDMENT', micro: 'DICE_ROLL' })
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

    it('transitions START -> DICE_ROLL in SPACE_COMBAT', () => {
      const current: PhaseIdentifier = { meta: 'SPACE_COMBAT', micro: 'START' }
      const result = getNextMicroPhase(current)
      expect(result.phase.micro).toBe('DICE_ROLL')
    })
  })

  describe('AFB meta-phase (unit ability flow)', () => {
    it('AFB starts at DICE_ROLL (first micro-phase)', () => {
      const current: PhaseIdentifier = { meta: 'AFB', micro: 'DICE_ROLL' }
      const result = getNextMicroPhase(current)
      expect(result.phase.micro).toBe('ASSIGN_HITS')
    })

    it('AFB stays at ASSIGN_HITS (last micro-phase)', () => {
      const current: PhaseIdentifier = { meta: 'AFB', micro: 'ASSIGN_HITS' }
      const result = getNextMicroPhase(current)
      // At last micro-phase, getNextMicroPhase returns same phase
      expect(result.phase.micro).toBe('ASSIGN_HITS')
    })

    it('AFB:ASSIGN_HITS transitions to SPACE_COMBAT:DICE_ROLL via getNextMetaPhase', () => {
      const current: PhaseIdentifier = { meta: 'AFB', micro: 'ASSIGN_HITS' }
      const result = getNextMetaPhase(current, 'SPACE')
      expect(result.phase.meta).toBe('SPACE_COMBAT')
      expect(result.phase.micro).toBe('DICE_ROLL')
      expect(result.incrementRound).toBe(false)
    })
  })

  describe('getNextMetaPhase', () => {
    describe('SPACE mode flow', () => {
      it('transitions SPACE_CANNON_OFFENSE -> SPACE_COMBAT', () => {
        const current: PhaseIdentifier = {
          meta: 'SPACE_CANNON_OFFENSE',
          micro: 'ASSIGN_HITS', // Last micro-phase for unit abilities
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
      it('transitions BOMBARDMENT -> COMMIT_UNITS', () => {
        const current: PhaseIdentifier = {
          meta: 'BOMBARDMENT',
          micro: 'ASSIGN_HITS', // Last micro-phase for unit abilities
        }
        const result = getNextMetaPhase(current, 'GROUND')
        expect(result.phase.meta).toBe('COMMIT_UNITS')
        expect(result.phase.micro).toBe('END') // Single pass-through micro-phase
      })

      it('transitions COMMIT_UNITS -> SPACE_CANNON_DEFENSE', () => {
        const current: PhaseIdentifier = {
          meta: 'COMMIT_UNITS',
          micro: 'END',
        }
        const result = getNextMetaPhase(current, 'GROUND')
        expect(result.phase.meta).toBe('SPACE_CANNON_DEFENSE')
        expect(result.phase.micro).toBe('DICE_ROLL') // First micro-phase for unit abilities
      })

      it('transitions SPACE_CANNON_DEFENSE -> GROUND_COMBAT', () => {
        const current: PhaseIdentifier = {
          meta: 'SPACE_CANNON_DEFENSE',
          micro: 'ASSIGN_HITS', // Last micro-phase for unit abilities
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
})
