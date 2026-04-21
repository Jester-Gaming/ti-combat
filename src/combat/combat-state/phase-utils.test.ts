import { describe, expect, it } from 'vitest'

import { getInitialMetaPhase, getNextPhaseInFlow } from './phase-utils'

describe('meta-phase flow', () => {
  describe('getInitialMetaPhase', () => {
    it('returns SPACE_CANNON_OFFENSE for SPACE mode', () => {
      expect(getInitialMetaPhase('SPACE')).toBe('SPACE_CANNON_OFFENSE')
    })

    it('returns BOMBARDMENT for GROUND mode', () => {
      expect(getInitialMetaPhase('GROUND')).toBe('BOMBARDMENT')
    })
  })

  describe('getNextPhaseInFlow', () => {
    describe('SPACE mode flow', () => {
      it('transitions SPACE_CANNON_OFFENSE -> SPACE_COMBAT', () => {
        expect(getNextPhaseInFlow('SPACE_CANNON_OFFENSE', 'SPACE')).toBe(
          'SPACE_COMBAT',
        )
      })

      it('SPACE_COMBAT -> COMPLETE (combat-meta looping is engine-driven)', () => {
        expect(getNextPhaseInFlow('SPACE_COMBAT', 'SPACE')).toBe('COMPLETE')
      })
    })

    describe('GROUND mode flow', () => {
      it('transitions BOMBARDMENT -> COMMIT_UNITS', () => {
        expect(getNextPhaseInFlow('BOMBARDMENT', 'GROUND')).toBe('COMMIT_UNITS')
      })

      it('transitions COMMIT_UNITS -> SPACE_CANNON_DEFENSE', () => {
        expect(getNextPhaseInFlow('COMMIT_UNITS', 'GROUND')).toBe(
          'SPACE_CANNON_DEFENSE',
        )
      })

      it('transitions SPACE_CANNON_DEFENSE -> GROUND_COMBAT', () => {
        expect(getNextPhaseInFlow('SPACE_CANNON_DEFENSE', 'GROUND')).toBe(
          'GROUND_COMBAT',
        )
      })

      it('GROUND_COMBAT -> COMPLETE (combat-meta looping is engine-driven)', () => {
        expect(getNextPhaseInFlow('GROUND_COMBAT', 'GROUND')).toBe('COMPLETE')
      })
    })

    describe('edge cases', () => {
      it('returns COMPLETE for an unrecognized meta', () => {
        expect(getNextPhaseInFlow('GROUND_COMBAT' as never, 'SPACE')).toBe(
          'COMPLETE',
        )
      })
    })
  })
})
