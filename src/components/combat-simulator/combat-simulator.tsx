import { clsx } from 'clsx'
import type { CSSProperties } from 'react'
import { useMemo, useReducer, useRef } from 'react'

import { CombatEngine, CombatState, flattenTree } from '@/combat'
import { getAvailableAbilities } from '@/combat/abilities'
import type { CombatMode } from '@/combat/combat-state/types'
import { AbilitiesPanel } from '@/components/abilities-panel'
import { BattleCard } from '@/components/battle-card'
import { GlassCard } from '@/components/ui/glass-card'
import { GlowText } from '@/components/ui/glow-text'
import type { CombatSide, FactionKey, UnitType } from '@/types'
import { getUnitConfig } from '@/utils/get-unit-config'

import { type CombatResult } from '../battle-card/components/combat-result-bar'
import styles from './combat-simulator.module.css'

interface CombatSimulatorProps {
  className?: string
}

export function CombatSimulator({ className }: CombatSimulatorProps) {
  const csRef = useRef(new CombatState())
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const cs = csRef.current

  const attackerConfig = useMemo(
    () => getUnitConfig(cs.attacker.faction),
    [cs.attacker.faction],
  )
  const defenderConfig = useMemo(
    () => getUnitConfig(cs.defender.faction),
    [cs.defender.faction],
  )

  // Get available abilities for each side (derived from faction, safe during render)
  const attackerAbilities = useMemo(
    () => getAvailableAbilities('attacker', cs.attacker.faction),
    [cs.attacker.faction],
  )
  const defenderAbilities = useMemo(
    () => getAvailableAbilities('defender', cs.defender.faction),
    [cs.defender.faction],
  )

  // Build read contexts for ability UI panels
  const attackerReadContext = useMemo(
    () => cs.getReadContext('attacker'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cs.data],
  )
  const defenderReadContext = useMemo(
    () => cs.getReadContext('defender'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cs.data],
  )

  // Create CombatState for simulation
  const combatState = useMemo(() => {
    return CombatState.forSimulation(
      cs.data.attacker,
      cs.data.defender,
      cs.combatMode,
      cs.data.abilities,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs.data])

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

  const handleFactionChange = (side: CombatSide, faction: FactionKey) => {
    cs.side(side).setFaction(faction)
    forceRender()
  }

  const handleUnitCountChange = (
    side: CombatSide,
    unit: UnitType,
    count: number,
  ) => {
    cs.side(side).setUnitCount(unit, count)
    forceRender()
  }

  const handleUpgradeToggle = (side: CombatSide, unit: UnitType) => {
    const ss = cs.side(side)
    ss.setUpgraded(unit, !ss.isUpgraded(unit))
    forceRender()
  }

  const handleAbilityParamsChange = (
    side: CombatSide,
    abilityName: string,
    params: Record<string, unknown>,
  ) => {
    cs.side(side).setAbilityParam(abilityName, params)
    forceRender()
  }

  const handleCombatModeChange = (mode: CombatMode) => {
    cs.setCombatMode(mode)
    forceRender()
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
          readContext={attackerReadContext}
          combatMode={cs.combatMode}
          params={cs.data.abilities.attacker}
          onParamsChange={(abilityName, params) =>
            handleAbilityParamsChange('attacker', abilityName, params)
          }
        />
      </GlassCard>

      {/* Center column: Battle card */}
      <div className={styles.centerColumn}>
        <BattleCard
          attackerFaction={cs.attacker.faction}
          defenderFaction={cs.defender.faction}
          attackerSelections={cs.attacker.unitSelections}
          defenderSelections={cs.defender.unitSelections}
          attackerConfig={attackerConfig}
          defenderConfig={defenderConfig}
          combatResult={combatResult}
          combatMode={cs.combatMode}
          onCombatModeChange={handleCombatModeChange}
          onFactionChange={handleFactionChange}
          onUnitCountChange={handleUnitCountChange}
          onUpgradeToggle={handleUpgradeToggle}
        />
      </div>

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
        <div className={styles.sidePanelScroll}>
          <AbilitiesPanel
            abilities={defenderAbilities}
            readContext={defenderReadContext}
            combatMode={cs.combatMode}
            params={cs.data.abilities.defender}
            onParamsChange={(abilityName, params) =>
              handleAbilityParamsChange('defender', abilityName, params)
            }
          />
        </div>
      </GlassCard>
    </div>
  )
}
