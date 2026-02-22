import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

export default buildCombatState({
  mode: 'SPACE',
  attacker: {
    faction: 'ARBOREC',
    units: { DREADNOUGHT: 5, FIGHTER: 10 },
  },
  defender: {
    faction: 'ARBOREC',
    units: { DREADNOUGHT: 5, FIGHTER: 10 },
  },
})
