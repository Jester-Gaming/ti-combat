import type { Ability } from '@/combat'

declare global {
  interface AbilityConfigMap {
    BOMBARDMENT: Record<string, never>
  }
}

export const bombardment: Ability = {
  key: 'BOMBARDMENT',
  name: 'Bombardment',
  description: 'Bombardment is resolved only when enabled',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  side: 'attacker',
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BOMBARDMENT_STEP',
      call: ctx => ctx.resolveStep('BOMBARDMENT'),
    },
  ],
}
