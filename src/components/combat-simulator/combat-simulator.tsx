import { clsx } from 'clsx'
import type { CSSProperties } from 'react'
import { useEffect, useMemo } from 'react'
import { useImmer } from 'use-immer'

import {
  CombatEngine,
  CombatState,
  flattenTree,
  type SideState as CombatSideState,
} from '@/combat'
import { getAvailableAbilities } from '@/combat/abilities'
import { countUnits } from '@/combat/state/side-state-ops'
import { AbilitiesPanel } from '@/components/abilities-panel'
import { BattleCard } from '@/components/battle-card'
import { GlassCard } from '@/components/ui/glass-card'
import { GlowText } from '@/components/ui/glow-text'
import factions from '@/data/faction'
import {
  type BattleState,
  type FactionKey,
  type Side,
  type SideState,
  UNIT_TYPES,
  type UnitState,
  type UnitType,
} from '@/types'
import { getSimulationUnits } from '@/utils/get-simulation-units'
import { getUnitConfig } from '@/utils/get-unit-config'

import { type CombatResult } from '../battle-card/components/combat-result-bar'
import styles from './combat-simulator.module.css'

function createInitialUnits(): Record<UnitType, UnitState> {
  return UNIT_TYPES.reduce(
    (acc, unitType) => {
      acc[unitType] = { count: 0, upgraded: false }
      return acc
    },
    {} as Record<UnitType, UnitState>,
  )
}

function createInitialSideState(): SideState {
  return {
    faction: Object.keys(factions)[0] as FactionKey,
    units: createInitialUnits(),
  }
}

function createInitialBattleState(): BattleState {
  return {
    attacker: createInitialSideState(),
    defender: createInitialSideState(),
  }
}

interface CombatSimulatorProps {
  className?: string
}

export function CombatSimulator({ className }: CombatSimulatorProps) {
  const [battle, setBattle] = useImmer<BattleState>(createInitialBattleState)
  const [abilityParams, setAbilityParams] = useImmer<{
    attacker: Record<string, Record<string, unknown>>
    defender: Record<string, Record<string, unknown>>
  }>({
    attacker: {},
    defender: {},
  })

  const attackerConfig = useMemo(
    () => getUnitConfig(battle.attacker.faction),
    [battle.attacker.faction],
  )
  const defenderConfig = useMemo(
    () => getUnitConfig(battle.defender.faction),
    [battle.defender.faction],
  )

  // Create SideState for each side (used for abilities and combat)
  const attackerSideState: CombatSideState = useMemo(
    () => ({
      faction: battle.attacker.faction,
      units: getSimulationUnits(battle.attacker),
      hitPools: [],
    }),
    [battle.attacker],
  )
  const defenderSideState: CombatSideState = useMemo(
    () => ({
      faction: battle.defender.faction,
      units: getSimulationUnits(battle.defender),
      hitPools: [],
    }),
    [battle.defender],
  )

  // Get available abilities for each side
  const attackerAbilities = useMemo(
    () => getAvailableAbilities('attacker', battle.attacker.faction),
    [battle.attacker.faction],
  )
  const defenderAbilities = useMemo(
    () => getAvailableAbilities('defender', battle.defender.faction),
    [battle.defender.faction],
  )

  // Initialize ability params with defaults when abilities change
  useEffect(() => {
    setAbilityParams(draft => {
      const attackerKeys = new Set(attackerAbilities.map(a => a.key))
      const defenderKeys = new Set(defenderAbilities.map(a => a.key))

      // Initialize new abilities with defaults, preserve existing params
      for (const ability of attackerAbilities) {
        if (!draft.attacker[ability.key] && ability.defaultParams) {
          draft.attacker[ability.key] = { ...ability.defaultParams }
        }
      }
      for (const ability of defenderAbilities) {
        if (!draft.defender[ability.key] && ability.defaultParams) {
          draft.defender[ability.key] = { ...ability.defaultParams }
        }
      }

      // Remove params for abilities that no longer exist
      for (const key of Object.keys(draft.attacker)) {
        if (!attackerKeys.has(key)) {
          delete draft.attacker[key]
        }
      }
      for (const key of Object.keys(draft.defender)) {
        if (!defenderKeys.has(key)) {
          delete draft.defender[key]
        }
      }
    })
  }, [attackerAbilities, defenderAbilities, setAbilityParams])

  // Create CombatState from battle configuration
  const combatState = useMemo(() => {
    const hasAttackerUnits = countUnits(attackerSideState) > 0
    const hasDefenderUnits = countUnits(defenderSideState) > 0

    if (!hasAttackerUnits || !hasDefenderUnits) {
      return null
    }

    return new CombatState(attackerSideState, defenderSideState, {
      attacker: {
        abilities: attackerAbilities,
        config: abilityParams.attacker,
      },
      defender: {
        abilities: defenderAbilities,
        config: abilityParams.defender,
      },
    })
  }, [
    attackerSideState,
    defenderSideState,
    attackerAbilities,
    defenderAbilities,
    abilityParams,
  ])

  const combatResult = useMemo((): CombatResult | null => {
    if (!combatState) return null

    const engine = new CombatEngine()
    console.time('Simulate')
    const tree = engine.simulate(combatState)
    console.timeEnd('Simulate')
    console.info('Simulate tree', tree)
    console.time('Flatten')
    const outcomes = flattenTree(tree)
    console.timeEnd('Flatten')
    console.info('Outcomes list', outcomes)

    let attackerWin = 0
    let draw = 0
    let defenderWin = 0

    for (const outcome of outcomes) {
      switch (outcome.winner) {
        case 'attacker':
          attackerWin += outcome.probability
          break
        case 'defender':
          defenderWin += outcome.probability
          break
        case 'draw':
          draw += outcome.probability
          break
      }
    }

    return { attackerWin, draw, defenderWin }
  }, [combatState])

  const handleFactionChange = (side: Side, faction: FactionKey) => {
    setBattle(draft => {
      draft[side].faction = faction
    })
  }

  const handleUnitCountChange = (side: Side, unit: UnitType, count: number) => {
    setBattle(draft => {
      draft[side].units[unit].count = count
    })
  }

  const handleUpgradeToggle = (side: Side, unit: UnitType) => {
    setBattle(draft => {
      draft[side].units[unit].upgraded = !draft[side].units[unit].upgraded
    })
  }

  const handleAbilityParamsChange = (
    side: Side,
    abilityName: string,
    params: Record<string, unknown>,
  ) => {
    setAbilityParams(draft => {
      draft[side][abilityName] = params
    })
  }

  return (
    <div className={clsx(styles.layout, className)}>
      {/* Left panel: Attacker abilities */}
      <GlassCard
        as="aside"
        className={clsx(styles.sidePanel, styles.sidePanelAttacker)}
      >
        <div className={styles.sidePanelHeader}>
          <GlowText
            as="h2"
            className={styles.sidePanelTitle}
            style={{ '--glow-color': 'var(--attacker)' } as CSSProperties}
          >
            Attacker Abilities
          </GlowText>
        </div>
        <AbilitiesPanel
          abilities={attackerAbilities}
          sideState={attackerSideState}
          params={abilityParams.attacker}
          onParamsChange={(abilityName, params) =>
            handleAbilityParamsChange('attacker', abilityName, params)
          }
        />
      </GlassCard>

      {/* Center: Main battle card */}
      <BattleCard
        battle={battle}
        attackerConfig={attackerConfig}
        defenderConfig={defenderConfig}
        combatResult={combatResult}
        onFactionChange={handleFactionChange}
        onUnitCountChange={handleUnitCountChange}
        onUpgradeToggle={handleUpgradeToggle}
      />

      {/* Right panel: Defender abilities */}
      <GlassCard
        as="aside"
        className={clsx(styles.sidePanel, styles.sidePanelDefender)}
      >
        <div className={styles.sidePanelHeader}>
          <GlowText
            as="h2"
            className={styles.sidePanelTitle}
            style={{ '--glow-color': 'var(--defender)' } as CSSProperties}
          >
            Defender Abilities
          </GlowText>
        </div>
        <AbilitiesPanel
          abilities={defenderAbilities}
          sideState={defenderSideState}
          params={abilityParams.defender}
          onParamsChange={(abilityName, params) =>
            handleAbilityParamsChange('defender', abilityName, params)
          }
        />
      </GlassCard>
    </div>
  )
}
