import { GearIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import type { CSSProperties } from 'react'
import { useMemo, useReducer, useRef, useState } from 'react'

import { CombatState } from '@/combat'
import { getAvailableAbilities } from '@/combat/abilities'
import type { CombatMode } from '@/combat/combat-state/types'
import { AbilitiesPanel } from '@/components/abilities-panel'
import { BattleCard } from '@/components/battle-card'
import { GlassCard } from '@/components/ui/glass-card'
import { GlowText } from '@/components/ui/glow-text'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSimulation } from '@/hooks/use-simulation'
import type { CombatSide, FactionKey, UnitType } from '@/types'
import { getUnitConfig } from '@/utils/get-unit-config'

import styles from './combat-simulator.module.css'

interface CombatSimulatorProps {
  className?: string
}

export function CombatSimulator({ className }: CombatSimulatorProps) {
  const csRef = useRef(new CombatState())
  const [, forceRender] = useReducer((x: number) => x + 1, 0)
  const [attackerSheetOpen, setAttackerSheetOpen] = useState(false)
  const [defenderSheetOpen, setDefenderSheetOpen] = useState(false)

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

  const simulationInput = useMemo(
    () => {
      const aSel = cs.attacker.unitSelections
      const dSel = cs.defender.unitSelections
      const hasUnits =
        Object.values(aSel).some(s => s.count > 0) ||
        Object.values(dSel).some(s => s.count > 0)
      if (!hasUnits) return null
      return {
        attackerFaction: cs.attacker.faction,
        defenderFaction: cs.defender.faction,
        attackerSelections: aSel,
        defenderSelections: dSel,
        combatMode: cs.combatMode,
        abilities: cs.data.abilities,
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cs.data],
  )

  const { outcomes, isComputing } = useSimulation(simulationInput)

  const unitPriority = useMemo(() => {
    const key =
      cs.combatMode === 'GROUND' ? 'groundUnitPriority' : 'spaceUnitPriority'
    const a = cs.data.abilities.attacker['UNIT_PRIORITY']
    const d = cs.data.abilities.defender['UNIT_PRIORITY']
    return {
      attacker: (a?.[key] as string[] | undefined) ?? [],
      defender: (d?.[key] as string[] | undefined) ?? [],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs.data])

  const combatResult = useMemo(() => {
    if (!outcomes) return null
    let attackerWin = 0
    let draw = 0
    let defenderWin = 0
    for (const o of outcomes) {
      switch (o.winner) {
        case 'attacker':
          attackerWin += o.probability
          break
        case 'defender':
          defenderWin += o.probability
          break
        case 'draw':
          draw += o.probability
          break
      }
    }
    return { attackerWin, draw, defenderWin }
  }, [outcomes])

  const handleSwap = () => {
    cs.swap()
    forceRender()
  }

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
          outcomes={outcomes}
          unitPriority={unitPriority}
          isComputing={isComputing}
          combatMode={cs.combatMode}
          onCombatModeChange={handleCombatModeChange}
          onFactionChange={handleFactionChange}
          onSwap={handleSwap}
          onUnitCountChange={handleUnitCountChange}
          onUpgradeToggle={handleUpgradeToggle}
          attackerActions={
            <button
              type="button"
              className={clsx(styles.gearButton, styles.gearButtonAttacker)}
              onClick={() => setAttackerSheetOpen(true)}
              title="Attacker abilities"
            >
              <GearIcon className={styles.gearButtonIcon} />
            </button>
          }
          defenderActions={
            <button
              type="button"
              className={clsx(styles.gearButton, styles.gearButtonDefender)}
              onClick={() => setDefenderSheetOpen(true)}
              title="Defender abilities"
            >
              <GearIcon className={styles.gearButtonIcon} />
            </button>
          }
        />
      </div>

      {/* Attacker abilities sheet (mobile) */}
      <Sheet open={attackerSheetOpen} onOpenChange={setAttackerSheetOpen}>
        <SheetContent side="left" className={styles.sheetAttacker}>
          <SheetTitle className="sr-only">Attacker Abilities</SheetTitle>
          <div className={styles.sheetHeader}>
            <GlowText
              as="h2"
              className={styles.sidePanelTitle}
              style={{ '--glow-color': 'var(--attacker)' } as CSSProperties}
            >
              Attacker Abilities
            </GlowText>
          </div>
          <SheetDescription className="sr-only">
            Configure attacker abilities
          </SheetDescription>
          <AbilitiesPanel
            abilities={attackerAbilities}
            readContext={attackerReadContext}
            combatMode={cs.combatMode}
            params={cs.data.abilities.attacker}
            onParamsChange={(abilityName, params) =>
              handleAbilityParamsChange('attacker', abilityName, params)
            }
          />
        </SheetContent>
      </Sheet>

      {/* Defender abilities sheet (mobile) */}
      <Sheet open={defenderSheetOpen} onOpenChange={setDefenderSheetOpen}>
        <SheetContent side="right" className={styles.sheetDefender}>
          <SheetTitle className="sr-only">Defender Abilities</SheetTitle>
          <div className={styles.sheetHeader}>
            <GlowText
              as="h2"
              className={styles.sidePanelTitle}
              style={{ '--glow-color': 'var(--defender)' } as CSSProperties}
            >
              Defender Abilities
            </GlowText>
          </div>
          <SheetDescription className="sr-only">
            Configure defender abilities
          </SheetDescription>
          <AbilitiesPanel
            abilities={defenderAbilities}
            readContext={defenderReadContext}
            combatMode={cs.combatMode}
            params={cs.data.abilities.defender}
            onParamsChange={(abilityName, params) =>
              handleAbilityParamsChange('defender', abilityName, params)
            }
          />
        </SheetContent>
      </Sheet>

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
