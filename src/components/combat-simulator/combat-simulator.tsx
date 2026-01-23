import { clsx } from 'clsx'
import type { CSSProperties } from 'react'
import { useCallback, useMemo } from 'react'
import { useImmer } from 'use-immer'

import { CombatEngine, flattenTree } from '@/combat'
import {
  nonEuclideanShielding,
  participatingUnits,
  sustainDamage,
  unitPriority,
} from '@/combat/abilities'
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

const availableAbilities = [
  participatingUnits,
  unitPriority,
  sustainDamage,
  nonEuclideanShielding,
]

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

  const buildAbilitiesForSide = useCallback(
    (side: Side) => {
      return availableAbilities.map(ability => ({
        ...ability,
        params: {
          ...ability.params,
          ...abilityParams[side][ability.key],
        },
      }))
    },
    [abilityParams],
  )

  const combatResult = useMemo((): CombatResult | null => {
    const attacker = getSimulationUnits(battle.attacker)
    const defender = getSimulationUnits(battle.defender)

    const hasAttackerUnits = Object.keys(attacker.counts).length > 0
    const hasDefenderUnits = Object.keys(defender.counts).length > 0

    if (!hasAttackerUnits || !hasDefenderUnits) {
      return null
    }

    const engine = new CombatEngine()

    const tree = engine.simulate(
      attacker.stats,
      attacker.counts,
      defender.stats,
      defender.counts,
      {
        attackerAbilities: buildAbilitiesForSide('attacker'),
        defenderAbilities: buildAbilitiesForSide('defender'),
      },
    )

    const outcomes = flattenTree(tree)

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
  }, [battle, buildAbilitiesForSide])

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
          abilities={availableAbilities}
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
          abilities={availableAbilities}
          params={abilityParams.defender}
          onParamsChange={(abilityName, params) =>
            handleAbilityParamsChange('defender', abilityName, params)
          }
        />
      </GlassCard>
    </div>
  )
}
