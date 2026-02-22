import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

export default buildCombatState({
  mode: 'SPACE',
  attacker: {
    faction: 'ARBOREC',
    units: { CARRIER: 4, CRUISER: 8, DESTROYER: 8, FIGHTER: 20 },
  },
  defender: {
    faction: 'ARBOREC',
    units: { CARRIER: 4, CRUISER: 8, DESTROYER: 8, FIGHTER: 20 },
  },
})
