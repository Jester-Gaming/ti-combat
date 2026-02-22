import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

export default buildCombatState({
  mode: 'SPACE',
  attacker: {
    faction: 'ARBOREC',
    units: { FIGHTER: 50 },
  },
  defender: {
    faction: 'ARBOREC',
    units: { FIGHTER: 50 },
  },
})
